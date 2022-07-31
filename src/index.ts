import { PDFExtract } from "pdf.js-extract";
import {
  ComprehendClient,
  DetectDominantLanguageCommand,
  DetectEntitiesCommand,
  DetectEntitiesCommandInput,
} from "@aws-sdk/client-comprehend";
import fs from "fs";
const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
import { join } from "path";

const app = express();

const pdfExtract = new PDFExtract();
const pdfToText = async (filePath: string) => {
  const res = await pdfExtract.extract(filePath, {});
  const text = res.pages
    .map((page) => page.content.map((content) => content.str).join(" "))
    .join(" ");
  return text;
};
const detectLanguageCode = async (text: string) => {
  const client = new ComprehendClient({
    region: "ap-south-1",
    apiVersion: "2017-11-27",
  });

  const command = new DetectDominantLanguageCommand({
    Text: text,
  });
  const res = await client.send(command);
  if (!res.Languages) {
    throw new Error("Language Not Found");
  }
  return res.Languages[0].LanguageCode;
};

const detectEntities = async (
  DetectEntitiesCommandInput: DetectEntitiesCommandInput
) => {
  const client = new ComprehendClient({
    region: "ap-south-1",
    apiVersion: "2017-11-27",
  });

  const command = new DetectEntitiesCommand(DetectEntitiesCommandInput);
  const res = await client.send(command);

  const dateEntities = res.Entities?.filter((entity) => entity.Type === "DATE");

  let entities: any = {
    location: res.Entities?.find((entity) => entity.Type === "LOCATION")?.Text,
  };
  if (dateEntities && dateEntities.length > 0) {
    entities = { ...entities, startDate: dateEntities[0].Text };
    if (dateEntities.length > 1)
      entities = { ...entities, endDate: dateEntities[1].Text };
  }
  return entities;
};

// middle ware
app.use(express.static("public")); //to access the files in public folder
app.use(cors()); // it enables all cors requests
app.use(fileUpload());

// file upload api
app.get("/", (req, res) => {
  return res.send({ msg: "Server Running" });
});
app.post("/upload", (req, res) => {
  if (!req.files) {
    return res.status(500).send({ msg: "file is not found" });
  }
  // accessing the file
  const myFile = req.files.file;

  //  mv() method places the file inside public directory
  myFile.mv(join(__dirname, myFile.name), async (err) => {
    if (err) {
      console.log(err);
      return res.status(500).send({ msg: err });
    }
    // returing the response with file path and name
    const text = await pdfToText(join(__dirname, myFile.name));
    fs.unlinkSync(join(__dirname, myFile.name));
    const LanguageCode = await detectLanguageCode(text);
    const entities = await detectEntities({ LanguageCode, Text: text });
    return res.send(entities);
  });
});

const PORT = process.env.PORT || 4500;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
