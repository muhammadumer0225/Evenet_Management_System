import { Navigate, Route, Routes } from 'react-router-dom';
import { DashLayout, GuestOnly, PublicLayout, RequireAuth, ScrollToTop } from './components/Layouts';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Expos from './pages/Expos';
import ExpoDetail from './pages/ExpoDetail';
import Exhibitors from './pages/Exhibitors';
import ExhibitorProfile from './pages/ExhibitorProfile';
import Schedule from './pages/Schedule';
import { Contact, Help, NotFound, Privacy } from './pages/StaticPages';
import { ForgotPassword, Login, Register, ResetPassword } from './pages/Auth';
import Overview from './pages/Overview';
import Messages from './pages/shared/Messages';
import Notifications from './pages/shared/Notifications';
import Account from './pages/shared/Account';
import Feedback from './pages/shared/Feedback';
import { AdminApplications, AdminExpos } from './pages/admin/AdminExpos';
import { AdminBooths, AdminSchedule, AdminCheckIn, AdminBoothVisits } from './pages/admin/AdminOps';
import { AdminAnalytics, AdminFeedback, AdminUsers } from './pages/admin/AdminInsights';
import { BookBooth, CompanyProfile, FindExpos, MyApplications, Neighbors, Showcase } from './pages/exhibitor/ExhibitorPages';
import ExhibitorAnalytics from './pages/exhibitor/ExhibitorAnalytics';
import { Agenda, MyExpos } from './pages/attendee/AttendeePages';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import Announcements from './pages/shared/Announcements';

/** Selects the dashboard screen permitted for the signed-in role. */
function ByRole({ admin, exhibitor, attendee }) {
  const { user } = useAuth();
  const C = { admin, exhibitor, attendee }[user.role];
  return C ? <C /> : <Navigate to="/dashboard" replace />;
}
const Only = (role, C) => function Guard() {
  const { user } = useAuth();
  return user.role === role ? <C /> : <Navigate to="/dashboard" replace />;
};

const ExhibitorsEmbedded = () => <Exhibitors embedded />;

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="expos" element={<Expos />} />
          <Route path="expos/:id" element={<ExpoDetail />} />
          <Route path="exhibitors" element={<Exhibitors />} />
          <Route path="exhibitors/:id" element={<ExhibitorProfile />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="help" element={<Help />} />
          <Route path="contact" element={<Contact />} />
          <Route path="privacy" element={<Privacy />} />
        </Route>

        <Route element={<GuestOnly />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
        </Route>
        <Route path="reset-password" element={<ResetPassword />} />

        <Route path="dashboard" element={<RequireAuth />}>
          <Route element={<DashLayout />}>
            <Route index element={<Overview />} />
            <Route path="expos" element={<ByRole admin={AdminExpos} exhibitor={FindExpos} attendee={MyExpos} />} />
            <Route path="applications" element={<ByRole admin={AdminApplications} exhibitor={MyApplications} />} />
            <Route path="booths" element={<ByRole admin={AdminBooths} />} />
            <Route path="check-in" element={<ByRole admin={AdminCheckIn} />} />
            <Route path="booth-visits" element={<ByRole admin={AdminBoothVisits} />} />
            <Route path="schedule" element={<ByRole admin={AdminSchedule} />} />
            <Route path="analytics" element={<ByRole admin={AdminAnalytics} />} />
            <Route path="users" element={<ByRole admin={AdminUsers} />} />
            <Route path="booth" element={<ByRole exhibitor={BookBooth} />} />
            <Route path="showcase" element={<ByRole exhibitor={Showcase} />} />
            <Route path="booth-analytics" element={<ByRole exhibitor={ExhibitorAnalytics} />} />
            <Route path="neighbors" element={<ByRole exhibitor={Neighbors} />} />
            <Route path="profile" element={<ByRole exhibitor={CompanyProfile} />} />
            <Route path="agenda" element={<ByRole attendee={Agenda} />} />
            <Route path="exhibitors" element={<ByRole attendee={ExhibitorsEmbedded} />} />
            <Route path="feedback" element={<ByRole admin={AdminFeedback} exhibitor={Feedback} attendee={Feedback} />} />
<Route
  path="announcements"
  element={
    <ByRole
      admin={AdminAnnouncements}
      exhibitor={Announcements}
      attendee={Announcements}
    />
  }
/>
            <Route path="messages" element={<Messages />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="account" element={<Account />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<PublicLayout />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
