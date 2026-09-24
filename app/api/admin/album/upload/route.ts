import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const filename = `${timestamp}_${originalName}`;
    const filepath = path.join(process.cwd(), 'public', 'assets', filename);

    await writeFile(filepath, buffer);

    return NextResponse.json({ success: true, filepath: `/assets/${filename}` });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ success: false, error: 'Failed to upload' }, { status: 500 });
  }
}
