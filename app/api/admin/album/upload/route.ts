import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/utils/auth/require-admin';
import { safeUploadFilename } from '@/utils/uploads';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  // This route had no authentication at all: any caller could write files into
  // public/assets.
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    const safeName = safeUploadFilename(file);
    if (!safeName.ok) {
      return NextResponse.json({ success: false, error: safeName.error }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filepath = path.join(process.cwd(), 'public', 'assets', safeName.filename);

    await writeFile(filepath, buffer);

    return NextResponse.json({ success: true, filepath: `/assets/${safeName.filename}` });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ success: false, error: 'Failed to upload' }, { status: 500 });
  }
}
