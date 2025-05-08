import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // First, delete any associated tasks
    await prisma.task.deleteMany({
      where: {
        documentId: id,
      },
    });

    // Then delete the document
    await prisma.document.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ message: 'Cleaning sheet deleted successfully' });
  } catch (error) {
    console.error('Error deleting cleaning sheet:', error);
    return NextResponse.json(
      { error: 'Failed to delete cleaning sheet' },
      { status: 500 }
    );
  }
} 