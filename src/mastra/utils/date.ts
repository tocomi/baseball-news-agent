/**
 * Date を M/D 形式の文字列に変換する
 */
export function formatDateLabel(date: Date): string {
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${month}/${day}`
}
