const cloudinary = require("../config/cloudinary");

/**
 * Sube un buffer de imagen a Cloudinary.
 * @param {Buffer} buffer
 * @param {string} folder
 * @returns {Promise<{ url: string, publicId: string }>}
 */
function uploadImageBuffer(buffer, folder = "Bolsos-CAP") {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

module.exports = {
  uploadImageBuffer,
};