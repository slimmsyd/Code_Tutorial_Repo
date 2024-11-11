import { default as createClient } from '@azure-rest/ai-vision-image-analysis';
import { AzureKeyCredential } from '@azure/core-auth';

const credential = new AzureKeyCredential(process.env.NEXT_PUBLIC_AZURE_VISION!);
const client = createClient(process.env.NEXT_PUBLIC_AZURE_VISION_ENDPOINT!, credential);

export async function analyzeImage(imageDataUrl: string) {
    if (!process.env.NEXT_PUBLIC_AZURE_VISION || !process.env.NEXT_PUBLIC_AZURE_VISION_ENDPOINT) {
        throw new Error("Azure credentials not configured");
    }

    // Convert base64 to binary
    const base64Data = imageDataUrl.split(',')[1];
    const binaryData = Buffer.from(base64Data, 'base64');

    const features = ['Caption', 'Read'];
          
    const result = await client.path('/imageanalysis:analyze').post({
        body: binaryData,
        queryParameters: {
            features: features
        },
        contentType: 'application/octet-stream'  // Changed from 'image/jpeg'
    });

    console.log(result.body);
    return result.body;
}
