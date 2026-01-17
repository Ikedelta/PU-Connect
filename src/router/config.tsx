import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import SellerApplication from '../pages/seller/SellerApplication';
import UserProfile from '../pages/profile/UserProfile';
import ProtectedRoute from './ProtectedRoute';

const Home = lazy(() => import('../pages/home/page'));
const Login = lazy(() => import('../pages/auth/Login'));
const AdminLogin = lazy(() => import('../pages/auth/AdminLogin'));
const Register = lazy(() => import('../pages/auth/Register'));
const Marketplace = lazy(() => import('../pages/marketplace/Marketplace'));
const ProductDetail = lazy(() => import('../pages/product/ProductDetail'));
const Messages = lazy(() => import('../pages/messages/Messages'));
const BecomeSeller = lazy(() => import('../pages/seller/BecomeSeller'));
const SellerDashboard = lazy(() => import('../pages/seller/SellerDashboard'));
const AddProduct = lazy(() => import('../pages/seller/AddProduct'));
const EditProduct = lazy(() => import('../pages/seller/EditProduct'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const UserManagement = lazy(() => import('../pages/admin/UserManagement'));
const ActivityMonitor = lazy(() => import('../pages/admin/ActivityMonitor'));
const AdminMessages = lazy(() => import('../pages/admin/AdminMessages'));
const NewsManagement = lazy(() => import('../pages/admin/NewsManagement'));
const NewsletterSubscribers = lazy(() => import('../pages/admin/NewsletterSubscribers'));
const SMSManagement = lazy(() => import('../pages/admin/SMSManagement'));
const AdsManagement = lazy(() => import('../pages/admin/AdsManagement'));
const WebsiteSettings = lazy(() => import('../pages/admin/WebsiteSettings'));
const ContentManagement = lazy(() => import('../pages/admin/ContentManagement'));
const CampusNews = lazy(() => import('../pages/news/CampusNews'));
const NewsDetail = lazy(() => import('../pages/news/NewsDetail'));
const NotFound = lazy(() => import('../pages/NotFound'));
const ApplicationStatus = lazy(() => import('../pages/seller/ApplicationStatus'));
const SellerApplications = lazy(() => import('../pages/admin/SellerApplications'));
const PaymentCallback = lazy(() => import('../pages/payment/PaymentCallback'));
const SubscriptionManagement = lazy(() => import('../pages/admin/SubscriptionManagement'));
const RoleManagement = lazy(() => import('../pages/admin/RoleManagement'));
const NewsPublisherDashboard = lazy(() => import('../pages/publisher/NewsPublisherDashboard'));
const Support = lazy(() => import('../pages/support/Support'));
const Internships = lazy(() => import('../pages/internships/Internships'));
const SupportTickets = lazy(() => import('../pages/admin/SupportTickets'));
const PollManagement = lazy(() => import('../pages/admin/PollManagement'));
const SellersList = lazy(() => import('../pages/admin/SellersList'));

const routes: RouteObject[] = [
  {
    path: '/admin/seller-applications',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <SellerApplications />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/sellers',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <SellersList />
      </ProtectedRoute>
    ),
  },
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/admin/login',
    element: <AdminLogin />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/marketplace',
    element: <Marketplace />,
  },
  {
    path: '/product/:id',
    element: <ProductDetail />,
  },
  {
    path: '/news',
    element: <CampusNews />,
  },
  {
    path: '/news/:id',
    element: <NewsDetail />,
  },
  {
    path: '/messages',
    element: (
      <ProtectedRoute>
        <Messages />
      </ProtectedRoute>
    ),
  },
  {
    path: '/seller/become',
    element: (
      <ProtectedRoute>
        <BecomeSeller />
      </ProtectedRoute>
    ),
  },
  {
    path: '/seller/apply',
    element: (
      <ProtectedRoute>
        <SellerApplication />
      </ProtectedRoute>
    ),
  },
  {
    path: '/seller/status',
    element: (
      <ProtectedRoute>
        <ApplicationStatus />
      </ProtectedRoute>
    ),
  },
  {
    path: '/seller/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['seller', 'admin', 'super_admin', 'publisher_seller']}>
        <SellerDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/seller/add-product',
    element: (
      <ProtectedRoute allowedRoles={['seller', 'admin', 'super_admin', 'publisher_seller']}>
        <AddProduct />
      </ProtectedRoute>
    ),
  },
  {
    path: '/seller/edit-product/:id',
    element: (
      <ProtectedRoute allowedRoles={['seller', 'admin', 'super_admin', 'publisher_seller']}>
        <EditProduct />
      </ProtectedRoute>
    ),
  },
  {
    path: '/payment/callback',
    element: <PaymentCallback />,
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <AdminDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <AdminDashboard />
      </ProtectedRoute>
    ),
  },

  {
    path: '/admin/users',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <UserManagement />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/news',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'super_admin', 'news_publisher', 'publisher_seller']}>
        <NewsManagement />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/newsletter',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <NewsletterSubscribers />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/sms',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <SMSManagement />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/ads',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'super_admin', 'news_publisher', 'publisher_seller']}>
        <AdsManagement />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/content',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <ContentManagement />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/settings',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <WebsiteSettings />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/activity',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <ActivityMonitor />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/messages',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <AdminMessages />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/subscriptions',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <SubscriptionManagement />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/roles',
    element: (
      <ProtectedRoute allowedRoles={['super_admin']}>
        <RoleManagement />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/seller-applications',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <SellerApplications />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/support',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <SupportTickets />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/polls',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <PollManagement />
      </ProtectedRoute>
    ),
  },

  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <UserProfile />
      </ProtectedRoute>
    ),
  },
  {
    path: '/publisher',
    element: (
      <ProtectedRoute allowedRoles={['news_publisher', 'admin', 'super_admin']}>
        <NewsPublisherDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/internships',
    element: <Internships />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
  {
    path: '/support',
    element: <Support />,
  },
];

export default routes;
