import { NextResponse } from "next/server";
import { getTeesheetWithTimeBlocks } from "~/server/teesheet/data";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  try {
    const { date } = await params;
    const data = await getTeesheetWithTimeBlocks(date);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching teesheet:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch teesheet" },
      { status: 500 },
    );
  }
}
