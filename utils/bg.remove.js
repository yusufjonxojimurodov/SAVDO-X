const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

async function removeBackground(inputPath) {
  const formData = new FormData();
  formData.append("image_file", fs.createReadStream(inputPath));
  formData.append("size", "auto");

  const response = await axios.post(
    "https://api.remove.bg/v1.0/removebg",
    formData,
    {
      headers: {
        ...formData.getHeaders(),
        "X-Api-Key": process.env.REMOVE_BG_API_KEY, // .env ichida bo‘lsin
      },
      responseType: "arraybuffer",
    }
  );

  // yangi fayl PNG shaklida
  const outputFile = inputPath.replace(path.extname(inputPath), ".png");
  fs.writeFileSync(outputFile, response.data);
  return outputFile;
}

module.exports = removeBackground;
