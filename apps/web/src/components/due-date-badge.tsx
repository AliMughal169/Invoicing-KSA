export function DueDateBadge({ dueDate, status }: { dueDate: string; status?: string }) {
  const date = new Date(dueDate);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const isOverdue = date < today;
  const isDueToday = date.toDateString() === today.toDateString();
  const isDueTomorrow = date.toDateString() === tomorrow.toDateString();
  const isDueSoon = date <= nextWeek && date >= tomorrow;

  const getColor = () => {
    if (isOverdue) return "bg-red-100 text-red-800";
    if (isDueToday) return "bg-orange-100 text-orange-800";
    if (isDueTomorrow || isDueSoon) return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
  };

  const getLabel = () => {
    if (isOverdue) return "Overdue";
    if (isDueToday) return "Due today";
    if (isDueTomorrow) return "Due tomorrow";
    if (isDueSoon) return "Due soon";
    return "Upcoming";
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getColor()}`}>
      {getLabel()}
    </span>
  );
}
