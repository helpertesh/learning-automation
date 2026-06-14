import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Units from './pages/Units';
import Notes from './pages/Notes';
import PastPapers from './pages/PastPapers';
import Assignments from './pages/Assignments';
import Study from './pages/Study';
import Notifications from './pages/Notifications';
import Journal from './pages/Journal';
import Calendar from './pages/Calendar';
import Timetable from './pages/Timetable';
import ExamPrep from './pages/ExamPrep';
import Quiz from './pages/Quiz';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="units" element={<Units />} />
        <Route path="notes" element={<Notes />} />
        <Route path="quizzes/:id" element={<Quiz />} />
        <Route path="past-papers" element={<PastPapers />} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="timetable" element={<Timetable />} />
        <Route path="exam-prep" element={<ExamPrep />} />
        <Route path="study" element={<Study />} />
        <Route path="journal" element={<Journal />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>
    </Routes>
  );
}
