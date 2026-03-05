import { useState, useEffect, useRef } from 'react';
import { FileEntry, useFiles } from '../contexts/FilesContext';

export function useFolderSiblings(filePath: string, filterType?: 'video' | 'document') {
    const { listDirectory } = useFiles();
    const [siblings, setSiblings] = useState<FileEntry[]>([]);
    const [isLoadingSiblings, setIsLoadingSiblings] = useState(false);

    // Stabilize listDirectory to prevent effect loops if context updates
    const listDirectoryRef = useRef(listDirectory);
    useEffect(() => {
        listDirectoryRef.current = listDirectory;
    }, [listDirectory]);

    useEffect(() => {
        let isMounted = true;

        async function loadSiblings() {
            if (!filePath) return;

            setIsLoadingSiblings(true);
            try {
                const separator = filePath.includes('/') ? '/' : '\\';
                const parts = filePath.split(separator);
                parts.pop();
                const parentPath = parts.join(separator);

                const entries = await listDirectoryRef.current(parentPath);

                if (!isMounted) return;

                let filteredSiblings: FileEntry[] = entries
                    .filter(entry => filterType ? entry.type === filterType : (entry.type === 'video' || entry.type === 'document'))
                    .map(entry => ({
                        name: entry.name,
                        path: entry.path,
                        file_type: entry.type as 'video' | 'document'
                    }));

                setSiblings(filteredSiblings);
            } catch (error) {
                console.error("Failed to load siblings:", error);
            } finally {
                if (isMounted) {
                    setIsLoadingSiblings(false);
                }
            }
        }

        loadSiblings();

        return () => {
            isMounted = false;
        };
    }, [filePath, filterType]);

    return { siblings, isLoadingSiblings };
}
