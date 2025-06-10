export const getPocketbaseImageUrl = (
    collectionId,
    recordId,
    filename,
  ) => {
    if (!filename || !collectionId || !recordId) return '';
    const apiUrl = import.meta.env.VITE_PB_URL || '';
    return `${apiUrl}/api/files/${collectionId}/${recordId}/${filename}`;
  };
export const generatePhoneHash = async (phone) => {
    if (!phone) return '';
    const encoder = new TextEncoder();
    const data = encoder.encode(phone);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };
  