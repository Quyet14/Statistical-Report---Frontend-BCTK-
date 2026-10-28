export const priorityLabels = { Low: "Thấp", Medium: "Trung bình", High: "Ưu tiên cao" };

export function formatTaskDate(value?: string) {
  if (!value) return "Chưa có hạn";
  const date = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return date ? `${date[3]}/${date[2]}/${date[1]}` : value;
}
