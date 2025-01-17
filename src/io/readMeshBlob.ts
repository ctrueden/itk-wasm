import readMeshArrayBuffer from './readMeshArrayBuffer.js'
import ReadMeshResult from './ReadMeshResult.js'

async function readMeshBlob (webWorker: Worker | null, blob: Blob, fileName: string, mimeType: string): Promise<ReadMeshResult> {
  const arrayBuffer = await blob.arrayBuffer()
  return await readMeshArrayBuffer(webWorker, arrayBuffer, fileName, mimeType)
}

export default readMeshBlob
