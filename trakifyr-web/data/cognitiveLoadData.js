// Dummy data for Cognitive Load Monitoring System

// Cognitive load levels over time (last 7 days)
export const cognitiveLoadTimeSeries = [
  { time: 'Mon 09:00', load: 45, engagement: 85 },
  { time: 'Mon 12:00', load: 62, engagement: 78 },
  { time: 'Mon 15:00', load: 78, engagement: 65 },
  { time: 'Tue 09:00', load: 42, engagement: 88 },
  { time: 'Tue 12:00', load: 58, engagement: 82 },
  { time: 'Tue 15:00', load: 71, engagement: 70 },
  { time: 'Wed 09:00', load: 48, engagement: 86 },
  { time: 'Wed 12:00', load: 65, engagement: 75 },
  { time: 'Wed 15:00', load: 82, engagement: 60 },
  { time: 'Thu 09:00', load: 40, engagement: 90 },
  { time: 'Thu 12:00', load: 55, engagement: 85 },
  { time: 'Thu 15:00', load: 68, engagement: 72 },
  { time: 'Fri 09:00', load: 50, engagement: 84 },
  { time: 'Fri 12:00', load: 70, engagement: 70 },
  { time: 'Fri 15:00', load: 85, engagement: 55 },
]

// Daily engagement data (bar chart)
export const dailyEngagementData = [
  { day: 'Monday', engagement: 76, sessions: 8 },
  { day: 'Tuesday', engagement: 80, sessions: 9 },
  { day: 'Wednesday', engagement: 74, sessions: 7 },
  { day: 'Thursday', engagement: 82, sessions: 10 },
  { day: 'Friday', engagement: 70, sessions: 6 },
  { day: 'Saturday', engagement: 65, sessions: 4 },
  { day: 'Sunday', engagement: 68, sessions: 5 },
]

// Session logs data
export const sessionLogs = [
  { id: 1, time: '2024-01-15 09:15:23', cognitiveLoad: 'Low', engagement: 'High', duration: '45 min' },
  { id: 2, time: '2024-01-15 10:30:12', cognitiveLoad: 'Medium', engagement: 'Medium', duration: '38 min' },
  { id: 3, time: '2024-01-15 14:20:45', cognitiveLoad: 'High', engagement: 'Low', duration: '25 min' },
  { id: 4, time: '2024-01-15 16:10:30', cognitiveLoad: 'Medium', engagement: 'High', duration: '52 min' },
  { id: 5, time: '2024-01-16 09:00:15', cognitiveLoad: 'Low', engagement: 'High', duration: '48 min' },
  { id: 6, time: '2024-01-16 11:25:20', cognitiveLoad: 'Medium', engagement: 'Medium', duration: '42 min' },
  { id: 7, time: '2024-01-16 15:40:10', cognitiveLoad: 'High', engagement: 'Low', duration: '30 min' },
  { id: 8, time: '2024-01-17 09:30:00', cognitiveLoad: 'Low', engagement: 'High', duration: '50 min' },
  { id: 9, time: '2024-01-17 13:15:35', cognitiveLoad: 'Medium', engagement: 'Medium', duration: '40 min' },
  { id: 10, time: '2024-01-17 17:00:50', cognitiveLoad: 'High', engagement: 'Low', duration: '28 min' },
]

// Current cognitive load status
export const currentCognitiveLoad = {
  level: 'Medium',
  value: 65,
  engagement: 72,
  timestamp: '2024-01-17 14:30:00',
}

// Feedback messages based on cognitive load
export const feedbackMessages = [
  {
    id: 1,
    type: 'warning',
    message: 'You seem overloaded, consider taking a break.',
    timestamp: '2024-01-17 15:00:00',
  },
  {
    id: 2,
    type: 'info',
    message: 'You appear disengaged, try refocusing.',
    timestamp: '2024-01-17 14:45:00',
  },
  {
    id: 3,
    type: 'success',
    message: 'Your cognitive load is optimal. Keep up the good work!',
    timestamp: '2024-01-17 14:00:00',
  },
]



