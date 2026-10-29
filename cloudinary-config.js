// Optional free image hosting. Create an unsigned image upload preset in Cloudinary.
// Set allowed formats to jpg, jpeg, png and webp; configure an incoming resize transformation.
// Never place a Cloudinary API secret in browser code.
export const cloudinaryConfig = {
  cloudName: 'PASTE_CLOUD_NAME_HERE',
  uploadPreset: 'PASTE_UNSIGNED_UPLOAD_PRESET_HERE'
};
export const isCloudinaryConfigured = () => Boolean(
  cloudinaryConfig.cloudName && cloudinaryConfig.cloudName !== 'PASTE_CLOUD_NAME_HERE' &&
  cloudinaryConfig.uploadPreset && cloudinaryConfig.uploadPreset !== 'PASTE_UNSIGNED_UPLOAD_PRESET_HERE'
);
