export const formatBytes = (bytes: number): string =>
    bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`;

export const formatDate = (date: Date): string => date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const downloadBlob = (blob: Blob, fileName: string) => {
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: fileName });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
};
