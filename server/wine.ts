import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import sharp from "sharp";

interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

interface CropResult {
  id: string;
  url: string;
  bbox: [number, number, number, number];
}

interface ProcessingResult {
  crops: CropResult[];
  bboxes: [number, number, number, number][];
}

function base64ToBuffer(base64: string): Buffer {
  const matches = base64.match(/^data:image\/(\w+);base64,(.*)$/);
  if (!matches) {
    throw new Error("Invalid base64 image data");
  }
  return Buffer.from(matches[2], "base64");
}

async function getImageDimensions(
  buffer: Buffer
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width || 1000,
    height: metadata.height || 1000,
  };
}

async function detectWineLabels(
  imageBase64: string
): Promise<BoundingBox[]> {
  // @ts-ignore - invokeLLM accepts array content for messages
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a wine bottle and label detection expert. Detect all wine bottles and their labels in the image.
Return a JSON array of bounding boxes for each detected label.
Use a coordinate system from 0 to 1000, where:
- 0 is the top/left edge
- 1000 is the bottom/right edge
Return ONLY valid JSON in this format:
[
  {"ymin": number, "xmin": number, "ymax": number, "xmax": number},
  ...
]
If no labels are detected, return an empty array: []`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Detect all wine bottle labels in this image. Return bounding boxes in [0-1000] normalized coordinates." },
          { type: "image_url", image_url: { url: imageBase64 } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "wine_labels",
        strict: true,
        schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ymin: { type: "number" },
              xmin: { type: "number" },
              ymax: { type: "number" },
              xmax: { type: "number" },
            },
            required: ["ymin", "xmin", "ymax", "xmax"],
            additionalProperties: false,
          },
        },
      },
    },
  });

  try {
    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      return [];
    }
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to parse LLM response:", error);
    return [];
  }
}

async function cropImageSharp(
  buffer: Buffer,
  bbox: BoundingBox,
  imageDimensions: { width: number; height: number }
): Promise<Buffer> {
  const actualWidth = imageDimensions.width;
  const actualHeight = imageDimensions.height;

  const scaleX = actualWidth / 1000;
  const scaleY = actualHeight / 1000;

  const pixelX = Math.floor(bbox.xmin * scaleX);
  const pixelY = Math.floor(bbox.ymin * scaleY);
  const pixelW = Math.ceil((bbox.xmax - bbox.xmin) * scaleX);
  const pixelH = Math.ceil((bbox.ymax - bbox.ymin) * scaleY);

  const padW = Math.max(1, Math.floor(pixelW * 0.05));
  const padH = Math.max(1, Math.floor(pixelH * 0.05));

  const cropX = Math.max(0, pixelX - padW);
  const cropY = Math.max(0, pixelY - padH);
  const cropW = Math.min(actualWidth - cropX, pixelW + padW * 2);
  const cropH = Math.min(actualHeight - cropY, pixelH + padH * 2);

  return sharp(buffer)
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
    .png()
    .toBuffer();
}

export async function processWineImage(
  imageBase64: string
): Promise<ProcessingResult> {
  try {
    const imageBuffer = base64ToBuffer(imageBase64);
    const detectedLabels = await detectWineLabels(imageBase64);

    if (detectedLabels.length === 0) {
      return { crops: [], bboxes: [] };
    }

    const imageDimensions = await getImageDimensions(imageBuffer);

    const crops: CropResult[] = [];
    const bboxes: [number, number, number, number][] = [];

    for (const bbox of detectedLabels) {
      try {
        const croppedBuffer = await cropImageSharp(
          imageBuffer,
          bbox,
          imageDimensions
        );

        const cropId = nanoid();
        const { url } = await storagePut(
          `wine-crops/${cropId}.png`,
          croppedBuffer,
          "image/png"
        );

        crops.push({
          id: cropId,
          url,
          bbox: [bbox.ymin, bbox.xmin, bbox.ymax, bbox.xmax],
        });

        bboxes.push([bbox.ymin, bbox.xmin, bbox.ymax, bbox.xmax]);
      } catch (error) {
        console.error("Failed to process individual label:", error);
      }
    }

    return { crops, bboxes };
  } catch (error) {
    console.error("Failed to process wine image:", error);
    throw error;
  }
}
