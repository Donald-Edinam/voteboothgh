export const getPocketbaseImageUrl = (
    collectionId,
    recordId,
    filename,
  ) => {
    if (!filename || !collectionId || !recordId) return '';
    const apiUrl = import.meta.env.VITE_PB_URL || '';
    return `${apiUrl}/api/files/${collectionId}/${recordId}/${filename}`;
  };
  