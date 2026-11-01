import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const root = createRoot(document.getElementById('root')!)
if (new URLSearchParams(window.location.search).get('preview') === 'expressions') {
  import('./expression-preview/ExpressionPreview').then(({ default: ExpressionPreview }) => {
    root.render(<StrictMode><ExpressionPreview /></StrictMode>)
  }).catch(() => root.render(<p role="alert">表情预览模块加载失败，请刷新页面。</p>))
} else if (new URLSearchParams(window.location.search).get('preview') === 'shuibuxin') {
  import('./character-preview/CharacterPreview').then(({ default: CharacterPreview }) => {
    root.render(<StrictMode><CharacterPreview /></StrictMode>)
  }).catch(() => root.render(<p role="alert">角色预览模块加载失败，请刷新页面。</p>))
} else {
  root.render(<StrictMode><App /></StrictMode>)
}

