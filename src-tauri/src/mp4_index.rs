//! Minimal MP4/MOV reader that derives video keyframe timestamps from the sample tables
//! (`stss`/`stts`/`ctts`) in the `moov` box, so segment boundaries don't need an ffprobe
//! packet scan of the whole file.
//!
//! The timestamps must match what ffmpeg's demuxer reports for the same packets. Only the
//! layouts where that mapping is simple are handled; everything else returns `None` and the
//! caller falls back to scanning. The caller also spot-checks the result against ffprobe.

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

/// Refuse to buffer absurdly large metadata (corrupt files).
const MAX_MOOV_SIZE: u64 = 256 * 1024 * 1024;
const MAX_SAMPLES: u64 = 4_000_000;

/// Returns the sorted keyframe presentation timestamps (seconds) of the track at
/// `stream_index`, or `None` when the file isn't a plain (non-fragmented) MP4 with a video
/// track there and a simple edit list.
pub fn read_keyframes(path: &Path, stream_index: usize) -> Option<Vec<f64>> {
    keyframes_from_moov(&read_moov(path)?, stream_index)
}

fn read_moov(path: &Path) -> Option<Vec<u8>> {
    let mut file = File::open(path).ok()?;
    let len = file.metadata().ok()?.len();
    let mut pos = 0u64;
    while pos + 8 <= len {
        file.seek(SeekFrom::Start(pos)).ok()?;
        let mut header = [0u8; 16];
        file.read_exact(&mut header[..8]).ok()?;
        let kind: [u8; 4] = header[4..8].try_into().ok()?;
        let (header_len, size) = match u32::from_be_bytes(header[..4].try_into().ok()?) {
            0 => (8, len - pos),
            1 => {
                file.read_exact(&mut header[8..]).ok()?;
                (16, u64::from_be_bytes(header[8..].try_into().ok()?))
            }
            n => (8, n as u64),
        };
        if size < header_len {
            return None;
        }
        match &kind {
            b"moov" => {
                let body_len = size - header_len;
                if body_len > MAX_MOOV_SIZE {
                    return None;
                }
                let mut body = vec![0u8; body_len as usize];
                file.read_exact(&mut body).ok()?;
                return Some(body);
            }
            // Fragmented MP4 keeps its sample tables in the fragments.
            b"moof" => return None,
            _ => pos = pos.checked_add(size)?,
        }
    }
    None
}

fn keyframes_from_moov(moov: &[u8], stream_index: usize) -> Option<Vec<f64>> {
    if child(moov, b"mvex").is_some() {
        return None;
    }
    let movie_timescale = timescale(child(moov, b"mvhd")?)?;

    // ffmpeg numbers streams in track order.
    let trak = boxes(moov).filter(|(kind, _)| *kind == b"trak").nth(stream_index)?.1;
    let mdia = child(trak, b"mdia")?;
    if child(mdia, b"hdlr")?.get(8..12)? != b"vide" {
        return None;
    }
    let media_timescale = timescale(child(mdia, b"mdhd")?)?;
    let stbl = child(child(mdia, b"minf")?, b"stbl")?;

    let presentation = presentation_times(child(stbl, b"stts")?, child(stbl, b"ctts"))?;
    let edit = match child(trak, b"edts").and_then(|edts| child(edts, b"elst")) {
        Some(elst) => Some(parse_edit_list(elst)?),
        None => None,
    };

    // With an edit list ffmpeg shifts the track so its first presented frame lands right
    // after any leading empty edit; without one the raw composition times are used.
    let (base, offset) = match edit {
        Some(edit) => {
            let first = *presentation.iter().min()?;
            // An edit that starts inside the stream drops/retimes frames; not handled here.
            if edit.media_time > first {
                return None;
            }
            (first, edit.empty_duration as f64 / movie_timescale as f64)
        }
        None => (0, 0.0),
    };
    let to_seconds = |cts: i64| (cts - base) as f64 / media_timescale as f64 + offset;

    let mut times: Vec<f64> = match child(stbl, b"stss") {
        Some(stss) => table(stss, 4)?
            .map(|entry| {
                // Sample numbers are 1-based.
                let sample = u32::from_be_bytes(entry.try_into().unwrap()) as usize;
                presentation.get(sample.checked_sub(1)?).copied().map(to_seconds)
            })
            .collect::<Option<_>>()?,
        // No sync sample table means every sample is a keyframe.
        None => presentation.iter().copied().map(to_seconds).collect(),
    };
    times.sort_by(|a, b| a.total_cmp(b));
    times.dedup();
    (times.len() >= 2).then_some(times)
}

/// Composition time (decode time + composition offset) of every sample, in media timescale.
fn presentation_times(stts: &[u8], ctts: Option<&[u8]>) -> Option<Vec<i64>> {
    let mut times = Vec::new();
    let mut dts = 0i64;
    for entry in table(stts, 8)? {
        let count = u32::from_be_bytes(entry[..4].try_into().unwrap()) as u64;
        let delta = u32::from_be_bytes(entry[4..].try_into().unwrap()) as i64;
        if times.len() as u64 + count > MAX_SAMPLES {
            return None;
        }
        for _ in 0..count {
            times.push(dts);
            dts += delta;
        }
    }

    if let Some(ctts) = ctts {
        let mut sample = 0usize;
        for entry in table(ctts, 8)? {
            let count = u32::from_be_bytes(entry[..4].try_into().unwrap()) as usize;
            // Read as signed for both box versions, like ffmpeg does.
            let offset = i32::from_be_bytes(entry[4..].try_into().unwrap()) as i64;
            let end = sample.saturating_add(count).min(times.len());
            for time in &mut times[sample..end] {
                *time += offset;
            }
            sample = end;
        }
    }
    Some(times)
}

struct Edit {
    /// Total length of the leading empty edits, in movie timescale.
    empty_duration: u64,
    /// Where the single real edit starts, in media timescale.
    media_time: i64,
}

/// Accepts leading empty edits followed by exactly one real edit; anything else (multiple
/// edits, dwell edits) changes timestamps in ways this reader doesn't model.
fn parse_edit_list(elst: &[u8]) -> Option<Edit> {
    let version = *elst.first()?;
    let entry_len = if version == 1 { 20 } else { 12 };
    let mut empty_duration = 0u64;
    let mut media_time = None;
    for entry in table(elst, entry_len)? {
        let (duration, time) = if version == 1 {
            (u64::from_be_bytes(entry[..8].try_into().unwrap()), i64::from_be_bytes(entry[8..16].try_into().unwrap()))
        } else {
            (
                u32::from_be_bytes(entry[..4].try_into().unwrap()) as u64,
                i32::from_be_bytes(entry[4..8].try_into().unwrap()) as i64,
            )
        };
        match (time, media_time) {
            (-1, None) => empty_duration += duration,
            (time, None) if time >= 0 => media_time = Some(time),
            _ => return None,
        }
    }
    Some(Edit { empty_duration, media_time: media_time? })
}

/// Timescale of an `mvhd`/`mdhd` box body.
fn timescale(body: &[u8]) -> Option<u64> {
    let offset = if *body.first()? == 1 { 20 } else { 12 };
    let value = u32::from_be_bytes(body.get(offset..offset + 4)?.try_into().ok()?);
    (value > 0).then_some(value as u64)
}

/// Entries of a full box laid out as `version/flags (4) | entry count (4) | entries`.
fn table(body: &[u8], entry_len: usize) -> Option<impl Iterator<Item = &[u8]>> {
    let count = u32::from_be_bytes(body.get(4..8)?.try_into().ok()?) as usize;
    let entries = body.get(8..8usize.checked_add(count.checked_mul(entry_len)?)?)?;
    Some(entries.chunks_exact(entry_len))
}

fn child<'a>(data: &'a [u8], kind: &[u8; 4]) -> Option<&'a [u8]> {
    boxes(data).find(|(k, _)| *k == kind).map(|(_, body)| body)
}

/// Iterates the boxes laid out back to back in `data`. Stops at the first malformed one.
fn boxes(mut data: &[u8]) -> impl Iterator<Item = (&[u8; 4], &[u8])> {
    std::iter::from_fn(move || {
        let kind: &[u8; 4] = data.get(4..8)?.try_into().ok()?;
        let (header_len, size) = match u32::from_be_bytes(data.get(..4)?.try_into().ok()?) {
            0 => (8, data.len()),
            1 => (16, usize::try_from(u64::from_be_bytes(data.get(8..16)?.try_into().ok()?)).ok()?),
            n => (8, n as usize),
        };
        let body = data.get(header_len..size)?;
        data = &data[size..];
        Some((kind, body))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bx(kind: &[u8; 4], body: &[u8]) -> Vec<u8> {
        let mut out = ((body.len() + 8) as u32).to_be_bytes().to_vec();
        out.extend_from_slice(kind);
        out.extend_from_slice(body);
        out
    }

    /// Full box holding a table of u32 fields.
    fn tbl(kind: &[u8; 4], entry_count: u32, fields: &[u32]) -> Vec<u8> {
        let mut body = vec![0u8; 4];
        body.extend_from_slice(&entry_count.to_be_bytes());
        for field in fields {
            body.extend_from_slice(&field.to_be_bytes());
        }
        bx(kind, &body)
    }

    /// Version 0 `mvhd`/`mdhd`: only the timescale matters.
    fn header(kind: &[u8; 4], timescale: u32) -> Vec<u8> {
        let mut body = vec![0u8; 12];
        body.extend_from_slice(&timescale.to_be_bytes());
        body.extend_from_slice(&[0u8; 4]);
        bx(kind, &body)
    }

    fn trak(handler: &[u8; 4], edits: Option<&[u32]>, with_stss: bool) -> Vec<u8> {
        let mut hdlr = vec![0u8; 8];
        hdlr.extend_from_slice(handler);
        // 6 samples, 1000 ticks apart, decode order I P B B I P with a 2000-tick reorder delay.
        let mut stbl = tbl(b"stts", 1, &[6, 1000]);
        stbl.extend(tbl(b"ctts", 6, &[1, 2000, 1, 4000, 1, 1000, 1, 1000, 1, 2000, 1, 2000]));
        if with_stss {
            stbl.extend(tbl(b"stss", 2, &[1, 5]));
        }
        let mdia = [header(b"mdhd", 1000), bx(b"hdlr", &hdlr), bx(b"minf", &bx(b"stbl", &stbl))].concat();
        let mut body = Vec::new();
        if let Some(edits) = edits {
            body.extend(bx(b"edts", &tbl(b"elst", (edits.len() / 3) as u32, edits)));
        }
        body.extend(bx(b"mdia", &mdia));
        bx(b"trak", &body)
    }

    fn moov(traks: &[Vec<u8>]) -> Vec<u8> {
        [header(b"mvhd", 600), traks.concat()].concat()
    }

    #[test]
    fn edit_list_rebases_keyframes_to_zero() {
        let moov = moov(&[trak(b"soun", None, true), trak(b"vide", Some(&[3600, 2000, 0x10000]), true)]);
        assert_eq!(keyframes_from_moov(&moov, 1), Some(vec![0.0, 4.0]));
    }

    #[test]
    fn leading_empty_edit_delays_the_track() {
        let edits = [300, u32::MAX, 0x10000, 3600, 2000, 0x10000];
        assert_eq!(keyframes_from_moov(&moov(&[trak(b"vide", Some(&edits), true)]), 0), Some(vec![0.5, 4.5]));
    }

    #[test]
    fn without_edit_list_composition_times_are_used_as_is() {
        assert_eq!(keyframes_from_moov(&moov(&[trak(b"vide", None, true)]), 0), Some(vec![2.0, 6.0]));
    }

    #[test]
    fn missing_sync_table_means_all_samples_are_keyframes() {
        let times = keyframes_from_moov(&moov(&[trak(b"vide", Some(&[3600, 2000, 0x10000]), false)]), 0).unwrap();
        assert_eq!(times, vec![0.0, 1.0, 2.0, 3.0, 4.0, 5.0]);
    }

    #[test]
    fn unsupported_layouts_are_rejected() {
        // Not a video track at that index.
        assert_eq!(keyframes_from_moov(&moov(&[trak(b"soun", None, true)]), 0), None);
        // Edit starting inside the stream.
        assert_eq!(keyframes_from_moov(&moov(&[trak(b"vide", Some(&[3600, 3000, 0x10000]), true)]), 0), None);
        // Two real edits.
        let edits = [1800, 2000, 0x10000, 1800, 4000, 0x10000];
        assert_eq!(keyframes_from_moov(&moov(&[trak(b"vide", Some(&edits), true)]), 0), None);
        // Fragmented.
        let fragmented = [moov(&[trak(b"vide", None, true)]), bx(b"mvex", &[])].concat();
        assert_eq!(keyframes_from_moov(&fragmented, 0), None);
    }

    #[test]
    fn finds_moov_after_other_boxes() {
        let moov_body = moov(&[trak(b"vide", None, true)]);
        let bytes = [bx(b"ftyp", b"isom"), bx(b"mdat", &[0u8; 64]), bx(b"moov", &moov_body)].concat();
        let mut file = tempfile::NamedTempFile::new().unwrap();
        std::io::Write::write_all(&mut file, &bytes).unwrap();
        assert_eq!(read_keyframes(file.path(), 0), Some(vec![2.0, 6.0]));
        assert_eq!(read_keyframes(Path::new("/definitely/not/here.mp4"), 0), None);
    }
}
