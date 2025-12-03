import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ExtractedData } from "../types";

// Initialize Gemini Client
// Note: API Key must be in process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const RESPONSE_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      fullName: { type: Type.STRING },
      phoneNumber: { type: Type.STRING },
      outreachMessage: { type: Type.STRING },
    },
    required: ["fullName", "phoneNumber", "outreachMessage"],
  },
};

const getSystemInstruction = (senderName: string, companyName: string) => {
  const hasSender = senderName && senderName.trim().length > 0;
  const hasCompany = companyName && companyName.trim().length > 0;

  const senderContext = hasSender ? `Sender Name: "${senderName}"` : `Sender Name: NOT PROVIDED (Do NOT invent a name).`;
  const companyContext = hasCompany ? `Company Name: "${companyName}"` : `Company Name: NOT PROVIDED (Do NOT invent a company name).`;

  const introRule = hasSender && hasCompany 
    ? `- "Hi [Name], ${senderName} from ${companyName} here"`
    : hasSender 
      ? `- "Hi [Name], it's ${senderName} reaching out"`
      : hasCompany
        ? `- "Hi [Name], reaching out from ${companyName}"`
        : `- "Hi [Name], reaching out regarding a CDL opportunity" (Skip names entirely)`;

  return `
You are an expert AI Recruitment Assistant. 
Your task is to extract driver leads from images or text and generate compliant SMS messages.

### EXTRACTION RULES:
1. Extract "Full Name" and "Phone Number" for drivers.
2. STRICTLY FILTER: Only extract drivers with MOBILE/CELL numbers. 
   - IGNORE Landlines, Work, Office, or Corporate numbers.
   - IGNORE entries with no phone number.
3. PRIVACY: DO NOT extract SSNs, DOBs, or Addresses.
4. Normalization: Format all phone numbers as (XXX) XXX-XXXX.

### CONTEXT - INPUTS:
${senderContext}
${companyContext}
Job Types available (Mention these variously):
- **Drop and Hook**
- **Dedicated Lanes**
- **Mail Loads**

### SMS GENERATION RULES (CRITICAL - STRICT VARIETY REQUIRED):
For EACH extracted driver, generate a **COMPLETELY UNIQUE** 'outreachMessage'.
**The user will be flagged for spam if messages look like templates. You MUST vary the phrasing.**

1. **NO REPETITION**: Do not use the same opening sentence structure twice in a row.
2. **Handle Identity (Strictly based on Inputs)**:
   ${introRule}
   - IF Sender Name is empty: DO NOT use "I'm [Name]" or "This is [Name]".
   - IF Company Name is empty: DO NOT use "from [Company]" or "with [Company]".
3. **Vary the "Hook" (Integrate Job Details)**:
   - "We have new **drop and hook** runs available..."
   - "Are you interested in **dedicated lanes**?"
   - "Looking for drivers for **mail loads**..."
   - "Are you open to CDL opportunities?"
   - "Would you be open to hearing about a new lane?"
   - *NOTE: Do not list all perks in one message. Pick ONE or NONE per message to keep it natural.*
4. **Vary the Syntax**: Change the order of the introduction and the question.

**Compliance Rules (Must apply to ALL):**
1. Must END with "Reply YES or STOP to opt out".

### EXAMPLE VARIATIONS (Examples assume Name="Paul", Company="TLG". ADAPT if inputs are empty):
- "Hi [Name], ${hasSender ? senderName : 'recruiter'} here${hasCompany ? ' with ' + companyName : ''}. We have some dedicated lanes opening up—are you available? Reply YES or STOP to opt out"
- "[Name], ${hasSender ? 'this is ' + senderName : 'checking in'}${hasCompany ? ' from ' + companyName : ''}. Are you interested in drop and hook runs specifically? Reply YES or STOP to opt out"
- "Hello [Name], ${hasCompany ? companyName : 'we'} have some mail loads starting soon—would you be open to hearing more? Reply YES or STOP to opt out"
- "Hey [Name], came across your info—are you currently in the market for a CDL position? Reply YES or STOP to opt out"
- "[Name], are you open to discussing local drop and hook options? Reply YES or STOP to opt out"
`;
};

/**
 * Helper to clean Markdown wrappers from JSON string.
 */
const cleanJsonOutput = (text: string) => {
  if (!text) return "[]";
  // Remove markdown code blocks (```json ... ```)
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

/**
 * Processes a file (Image or Text) to extract leads using Gemini.
 * @param fileContent Base64 string (for images) or raw text string
 * @param mimeType Mime type of the file
 * @param senderName Optional sender name
 * @param companyName Optional company name
 */
export const extractLeadsFromFile = async (
  fileContent: string,
  mimeType: string,
  senderName: string = "",
  companyName: string = ""
): Promise<ExtractedData[]> => {
  try {
    const isImage = mimeType.startsWith("image/");
    
    let contents;

    if (isImage) {
      // For images, we send the base64 data
      contents = {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: fileContent,
            },
          },
          {
            text: "Extract the driver list from this image. Return valid JSON.",
          },
        ],
      };
    } else {
      // For text/csv files
      contents = {
        parts: [
          {
            text: `Extract the driver list from the following text data:\n\n${fileContent}`,
          },
        ],
      };
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: getSystemInstruction(senderName, companyName),
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 1.2, // Balanced for variety (SMS) and structural stability (JSON)
      },
      contents: contents,
    });

    let textOutput = response.text;
    if (!textOutput) return [];

    // Sanitize the output before parsing
    textOutput = cleanJsonOutput(textOutput);

    const parsedData = JSON.parse(textOutput) as ExtractedData[];
    return parsedData;

  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    // Throwing here allows App.tsx to catch it and display the red error box
    throw new Error("Failed to extract data. The file might be unclear or the AI could not find valid leads.");
  }
};