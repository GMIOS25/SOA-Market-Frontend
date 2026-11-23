import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import relativeTime from 'dayjs/plugin/relativeTime'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

// API luôn trả thời gian UTC (ISO 8601); UI luôn hiển thị UTC+7 (BR-GEN-03, ASM-06).
export const APP_TIMEZONE = 'Asia/Ho_Chi_Minh'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)
dayjs.locale('vi')
dayjs.tz.setDefault(APP_TIMEZONE)

export { dayjs }
