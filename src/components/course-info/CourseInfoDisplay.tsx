type CourseInfoDisplayProps = {
  data: {
    weatherStatus?: string | null;
    forecast?: string | null;
    rainfall?: string | null;
    notes?: string | null;
  };
};

export function CourseInfoDisplay({ data }: CourseInfoDisplayProps) {
  if (!data) return null;

  const { notes } = data;

  // Only show course notes, no weather information
  if (!notes) return null;

  return (
    <div className="w-full rounded-lg bg-white p-4 shadow-md">
      {/* Course Notes */}
      <div className="rounded-md bg-gray-50 p-3">
        <div
          className="prose prose-sm max-w-none text-gray-700"
          dangerouslySetInnerHTML={{ __html: notes }}
        />
      </div>
    </div>
  );
}
