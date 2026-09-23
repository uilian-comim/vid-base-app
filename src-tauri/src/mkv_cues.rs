//! Minimal Matroska reader that pulls the video keyframe timestamps out of the Cues index.
//! This lets us compute HLS segment boundaries in milliseconds instead of demuxing the
//! whole file with ffprobe (which reads every byte — slow for large files on HDDs/NAS).

use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::Path;

const EBML_HEADER: u32 = 0x1A45_DFA3;
const SEGMENT: u32 = 0x1853_8067;
const SEEK_HEAD: u32 = 0x114D_9B74;
const SEEK: u32 = 0x4DBB;
const SEEK_ID: u32 = 0x53AB;
const SEEK_POSITION: u32 = 0x53AC;
const INFO: u32 = 0x1549_A966;
const TIMESTAMP_SCALE: u32 = 0x2A_D7B1;
const TRACKS: u32 = 0x1654_AE6B;
const TRACK_ENTRY: u32 = 0xAE;
const TRACK_NUMBER: u32 = 0xD7;
const TRACK_TYPE: u32 = 0x83;
const CUES: u32 = 0x1C53_BB6B;
const CUE_POINT: u32 = 0xBB;
const CUE_TIME: u32 = 0xB3;
const CUE_TRACK_POSITIONS: u32 = 0xB7;
const CUE_TRACK: u32 = 0xF7;
const CLUSTER: u32 = 0x1F43_B675;

const TRACK_TYPE_VIDEO: u64 = 1;
const DEFAULT_TIMESTAMP_SCALE: u64 = 1_000_000;
/// Refuse to buffer absurdly large metadata elements (corrupt files).
const MAX_ELEMENT_SIZE: u64 = 64 * 1024 * 1024;

/// Returns the sorted keyframe timestamps (seconds) of the first video track, or `None` when
/// the file has no usable Cues and the caller should fall back to scanning packets.
pub fn read_keyframes(path: &Path) -> Option<Vec<f64>> {
    let mut r = BufReader::new(File::open(path).ok()?);

    let (id, size) = read_element_header(&mut r)?;
    if id != EBML_HEADER {
        return None;
    }
    r.seek_relative(size? as i64).ok()?;

    let (id, _) = read_element_header(&mut r)?;
    if id != SEGMENT {
        return None;
    }
    let segment_start = r.stream_position().ok()?;

    let mut seek_positions: HashMap<u32, u64> = HashMap::new();
    let mut elements: HashMap<u32, Vec<u8>> = HashMap::new();

    // Metadata normally sits before the first Cluster; Cues are usually at the end and
    // reached through the SeekHead.
    while let Some((id, size)) = read_element_header(&mut r) {
        match id {
            SEEK_HEAD | INFO | TRACKS | CUES => {
                let body = read_body(&mut r, size?)?;
                if id == SEEK_HEAD {
                    seek_positions.extend(parse_seek_head(&body));
                } else {
                    elements.insert(id, body);
                }
            }
            CLUSTER => break,
            _ => match size {
                Some(size) => r.seek_relative(size as i64).ok()?,
                None => break,
            },
        }
        if [INFO, TRACKS, CUES].iter().all(|id| elements.contains_key(id)) {
            break;
        }
    }

    for id in [INFO, TRACKS, CUES] {
        if elements.contains_key(&id) {
            continue;
        }
        let Some(&pos) = seek_positions.get(&id) else {
            continue;
        };
        r.seek(SeekFrom::Start(segment_start + pos)).ok()?;
        let (found, size) = read_element_header(&mut r)?;
        if found == id {
            elements.insert(id, read_body(&mut r, size?)?);
        }
    }

    let scale = elements
        .get(&INFO)
        .and_then(|info| find_uint(info, TIMESTAMP_SCALE))
        .unwrap_or(DEFAULT_TIMESTAMP_SCALE);
    let video_track = find_video_track(elements.get(&TRACKS)?)?;
    keyframes_from_cues(elements.get(&CUES)?, video_track, scale)
}

fn keyframes_from_cues(cues: &[u8], video_track: u64, scale: u64) -> Option<Vec<f64>> {
    let mut times: Vec<f64> = children(cues)
        .filter(|(id, _)| *id == CUE_POINT)
        .filter_map(|(_, point)| {
            let time = find_uint(point, CUE_TIME)?;
            let has_video = children(point)
                .filter(|(id, _)| *id == CUE_TRACK_POSITIONS)
                .any(|(_, pos)| find_uint(pos, CUE_TRACK) == Some(video_track));
            has_video.then(|| time as f64 * scale as f64 / 1e9)
        })
        .collect();

    times.sort_by(|a, b| a.total_cmp(b));
    times.dedup();
    // A single cue point (or none) gives us nothing to segment on.
    (times.len() >= 2).then_some(times)
}

fn find_video_track(tracks: &[u8]) -> Option<u64> {
    children(tracks)
        .filter(|(id, _)| *id == TRACK_ENTRY)
        .find(|(_, entry)| find_uint(entry, TRACK_TYPE) == Some(TRACK_TYPE_VIDEO))
        .and_then(|(_, entry)| find_uint(entry, TRACK_NUMBER))
}

fn parse_seek_head(body: &[u8]) -> Vec<(u32, u64)> {
    children(body)
        .filter(|(id, _)| *id == SEEK)
        .filter_map(|(_, seek)| {
            let id_bytes = children(seek).find(|(id, _)| *id == SEEK_ID)?.1;
            let id = id_bytes.iter().fold(0u32, |acc, b| (acc << 8) | *b as u32);
            Some((id, find_uint(seek, SEEK_POSITION)?))
        })
        .collect()
}

fn find_uint(data: &[u8], wanted: u32) -> Option<u64> {
    children(data)
        .find(|(id, _)| *id == wanted)
        .filter(|(_, body)| body.len() <= 8)
        .map(|(_, body)| body.iter().fold(0u64, |acc, b| (acc << 8) | *b as u64))
}

/// Iterates the direct children of a master element's body. Stops at the first malformed
/// or unknown-sized child.
fn children(mut data: &[u8]) -> impl Iterator<Item = (u32, &[u8])> {
    std::iter::from_fn(move || {
        let (id, id_len) = parse_vint(data, false)?;
        let (size, size_len) = parse_vint(data.get(id_len..)?, true)?;
        let start = id_len + size_len;
        let end = start.checked_add(usize::try_from(size?).ok()?)?;
        let body = data.get(start..end)?;
        data = &data[end..];
        Some((id? as u32, body))
    })
}

/// Parses an EBML variable-length integer. IDs keep their length marker bits; sizes have it
/// stripped and report `None` for the reserved "unknown size" value.
fn parse_vint(data: &[u8], is_size: bool) -> Option<(Option<u64>, usize)> {
    let first = *data.first()?;
    let len = first.leading_zeros() as usize + 1;
    if len > 8 || data.len() < len {
        return None;
    }
    let mut value = if is_size {
        (first & (0xFFu16 >> len) as u8) as u64
    } else {
        first as u64
    };
    for b in &data[1..len] {
        value = (value << 8) | *b as u64;
    }
    let unknown = is_size && value == (1u64 << (7 * len)) - 1;
    Some((if unknown { None } else { Some(value) }, len))
}

fn read_element_header<R: Read>(r: &mut R) -> Option<(u32, Option<u64>)> {
    let id = read_vint(r, false)?.ok_or(()).ok()?;
    let size = read_vint(r, true)?;
    Some((id as u32, size))
}

fn read_vint<R: Read>(r: &mut R, is_size: bool) -> Option<Option<u64>> {
    let mut buf = [0u8; 8];
    r.read_exact(&mut buf[..1]).ok()?;
    let len = buf[0].leading_zeros() as usize + 1;
    if len > 8 {
        return None;
    }
    r.read_exact(&mut buf[1..len]).ok()?;
    parse_vint(&buf[..len], is_size).map(|(v, _)| v)
}

fn read_body<R: Read>(r: &mut R, size: u64) -> Option<Vec<u8>> {
    if size > MAX_ELEMENT_SIZE {
        return None;
    }
    let mut body = vec![0u8; size as usize];
    r.read_exact(&mut body).ok()?;
    Some(body)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn element(id: u32, body: &[u8]) -> Vec<u8> {
        let id_bytes = id.to_be_bytes();
        let skip = id_bytes.iter().position(|b| *b != 0).unwrap();
        let mut out = id_bytes[skip..].to_vec();
        // 8-byte size vint: 0x01 marker followed by 7 bytes of length.
        out.push(0x01);
        out.extend_from_slice(&(body.len() as u64).to_be_bytes()[1..]);
        out.extend_from_slice(body);
        out
    }

    fn uint(id: u32, value: u64) -> Vec<u8> {
        element(id, &value.to_be_bytes())
    }

    fn cue_point(time: u64, track: u64) -> Vec<u8> {
        let positions = element(CUE_TRACK_POSITIONS, &uint(CUE_TRACK, track));
        element(CUE_POINT, &[uint(CUE_TIME, time), positions].concat())
    }

    fn build_mkv(cues_before_clusters: bool) -> Vec<u8> {
        let info = element(INFO, &uint(TIMESTAMP_SCALE, 1_000_000));
        let tracks = element(
            TRACKS,
            &[
                element(TRACK_ENTRY, &[uint(TRACK_NUMBER, 1), uint(TRACK_TYPE, 2)].concat()),
                element(TRACK_ENTRY, &[uint(TRACK_NUMBER, 2), uint(TRACK_TYPE, 1)].concat()),
            ]
            .concat(),
        );
        let cues = element(
            CUES,
            &[cue_point(5005, 2), cue_point(0, 2), cue_point(3000, 1), cue_point(10010, 2)].concat(),
        );
        let cluster = element(CLUSTER, &[0u8; 32]);

        let mut body = Vec::new();
        if cues_before_clusters {
            body = [info, tracks, cues, cluster].concat();
        } else {
            let pre = [info, tracks].concat();
            // SeekHead is 1 fixed-size element; compute where Cues will land after it.
            let seek_head_len = element(
                SEEK_HEAD,
                &element(SEEK, &[element(SEEK_ID, &CUES.to_be_bytes()), uint(SEEK_POSITION, 0)].concat()),
            )
            .len();
            let cues_pos = (seek_head_len + pre.len() + cluster.len()) as u64;
            let seek_head = element(
                SEEK_HEAD,
                &element(SEEK, &[element(SEEK_ID, &CUES.to_be_bytes()), uint(SEEK_POSITION, cues_pos)].concat()),
            );
            body.extend([seek_head, pre, cluster, cues].concat());
        }

        [element(EBML_HEADER, &[0x42, 0x86, 0x81, 0x01]), element(SEGMENT, &body)].concat()
    }

    fn write_temp(bytes: &[u8]) -> tempfile::NamedTempFile {
        let mut file = tempfile::NamedTempFile::new().unwrap();
        std::io::Write::write_all(&mut file, bytes).unwrap();
        file
    }

    #[test]
    fn reads_video_keyframes_from_inline_cues() {
        let file = write_temp(&build_mkv(true));
        assert_eq!(read_keyframes(file.path()), Some(vec![0.0, 5.005, 10.01]));
    }

    #[test]
    fn follows_seek_head_to_trailing_cues() {
        let file = write_temp(&build_mkv(false));
        assert_eq!(read_keyframes(file.path()), Some(vec![0.0, 5.005, 10.01]));
    }

    #[test]
    fn rejects_non_matroska_files() {
        let file = write_temp(b"not a matroska file at all");
        assert_eq!(read_keyframes(file.path()), None);
    }

    #[test]
    fn parses_unknown_size_marker() {
        assert_eq!(parse_vint(&[0xFF], true), Some((None, 1)));
        assert_eq!(parse_vint(&[0x81], true), Some((Some(1), 1)));
        assert_eq!(parse_vint(&[0x40, 0x02], true), Some((Some(2), 2)));
    }
}
