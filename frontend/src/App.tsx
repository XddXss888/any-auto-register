import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { App as AntdApp, ConfigProvider, Layout, Menu, Button, Spin, Drawer } from 'antd'
import {
  DashboardOutlined,
  UserOutlined,
  GlobalOutlined,
  HistoryOutlined,
  SettingOutlined,
  SunOutlined,
  MoonOutlined,
  LogoutOutlined,
  MenuOutlined,
} from '@ant-design/icons'
import zhCN from 'antd/locale/zh_CN'
import Dashboard from '@/pages/Dashboard'
import Accounts from '@/pages/Accounts'
import RegisterTaskPage from '@/pages/RegisterTaskPage'
import Proxies from '@/pages/Proxies'
import Settings from '@/pages/Settings'
import TaskHistory from '@/pages/TaskHistory'
import Login from '@/pages/Login'
import { darkTheme, lightTheme } from './theme'
import { apiFetch, clearToken, getToken } from '@/lib/utils'

const { Sider, Content, Header } = Layout

function ProtectedLayout() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(s => {
        const token = getToken()
        if (s.has_password && !token) {
          navigate('/login', { replace: true })
        } else {
          setReady(true)
        }
      })
      .catch(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  return <AppContent />
}

function AppContent() {
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  )
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [platforms, setPlatforms] = useState<{ key: string; label: string }[]>([])
  const [hasPassword, setHasPassword] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('light', themeMode === 'light')
    document.documentElement.style.setProperty(
      '--sider-trigger-border',
      themeMode === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)'
    )
    localStorage.setItem('theme', themeMode)
  }, [themeMode])

  useEffect(() => {
    fetch('/api/auth/status').then(r => r.json()).then(s => setHasPassword(s.has_password)).catch(() => {})
  }, [])

  useEffect(() => {
    apiFetch('/platforms')
      .then(d => setPlatforms((d || [])
        .filter((p: any) => !['tavily', 'cursor'].includes(p.name))
        .map((p: any) => ({ key: p.name, label: p.display_name }))))
      .catch(() => {})
  }, [])

  const isLight = themeMode === 'light'
  const currentTheme = isLight ? lightTheme : darkTheme

  const getSelectedKey = () => {
    const path = location.pathname
    if (path === '/') return ['/']
    if (path.startsWith('/accounts')) return [path]
    if (path === '/history') return ['/history']
    if (path === '/proxies') return ['/proxies']
    if (path === '/settings') return ['/settings']
    return ['/']
  }

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: '/accounts',
      icon: <UserOutlined />,
      label: '平台管理',
      children: platforms.map(p => ({
        key: `/accounts/${p.key}`,
        label: p.label,
      })),
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: '任务历史',
    },
    {
      key: '/proxies',
      icon: <GlobalOutlined />,
      label: '代理管理',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '全局配置',
    },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
    if (isMobile) setDrawerOpen(false)
  }

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: `1px solid ${currentTheme.token?.colorBorder}`,
        }}
      >
        <DashboardOutlined style={{ fontSize: 20, color: currentTheme.token?.colorPrimary }} />
        {(!collapsed || isMobile) && (
          <span
            style={{
              marginLeft: 8,
              fontWeight: 600,
              fontSize: 14,
              color: currentTheme.token?.colorText,
            }}
          >
            Account Manager
          </span>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Menu
          mode="inline"
          selectedKeys={getSelectedKey()}
          defaultOpenKeys={['/accounts']}
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            borderRight: 0,
            background: 'transparent',
          }}
        />
      </div>
      <div
        style={{
          padding: '16px',
          borderTop: `1px solid ${currentTheme.token?.colorBorder}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <Button
          block
          icon={isLight ? <SunOutlined /> : <MoonOutlined />}
          onClick={() => setThemeMode(isLight ? 'dark' : 'light')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: (!collapsed || isMobile) ? 'space-between' : 'center',
          }}
        >
          {(!collapsed || isMobile) && (isLight ? '亮色模式' : '暗色模式')}
        </Button>
        {hasPassword && (
          <Button
            block
            danger
            icon={<LogoutOutlined />}
            onClick={() => { clearToken(); navigate('/login') }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: (!collapsed || isMobile) ? 'space-between' : 'center',
            }}
          >
            {(!collapsed || isMobile) && '退出登录'}
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <ConfigProvider theme={currentTheme} locale={zhCN}>
      <AntdApp>
      <Layout style={{ minHeight: '100vh' }}>
        {!isMobile && (
          <Sider
            collapsible
            collapsed={collapsed}
            onCollapse={setCollapsed}
            style={{
              background: currentTheme.token?.colorBgContainer,
              borderRight: `1px solid ${currentTheme.token?.colorBorder}`,
            }}
            width={220}
          >
            {sidebarContent}
          </Sider>
        )}
        
        {isMobile && (
          <Drawer
            placement="left"
            closable={false}
            onClose={() => setDrawerOpen(false)}
            open={drawerOpen}
            width={240}
            bodyStyle={{ padding: 0, background: currentTheme.token?.colorBgContainer }}
          >
            {sidebarContent}
          </Drawer>
        )}

        <Layout>
          {isMobile && (
            <Header style={{ 
              background: currentTheme.token?.colorBgContainer, 
              padding: '0 16px', 
              display: 'flex', 
              alignItems: 'center',
              borderBottom: `1px solid ${currentTheme.token?.colorBorder}`
            }}>
              <Button type="text" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} style={{ fontSize: '18px', marginRight: 16 }} />
              <span style={{ fontWeight: 600, fontSize: 16, color: currentTheme.token?.colorText }}>Account Manager</span>
            </Header>
          )}
          <Content
            style={{
              padding: isMobile ? 16 : 24,
              overflow: 'auto',
              background: currentTheme.token?.colorBgLayout,
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/accounts/:platform" element={<Accounts />} />
              <Route path="/register" element={<RegisterTaskPage />} />
              <Route path="/history" element={<TaskHistory />} />
              <Route path="/proxies" element={<Proxies />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
      </AntdApp>
    </ConfigProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  )
}
