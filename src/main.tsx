import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const root = createRoot(document.getElementById('root')!)
if (new URLSearchParams(window.location.search).get('preview') === 'single-actions-study') {
  import('./single-actions-preview/SingleActionsPreview').then(({ default: SingleActionsPreview }) => {
    root.render(<StrictMode><SingleActionsPreview /></StrictMode>)
  }).catch(() => root.render(<p role="alert">坐姿研究预览加载失败，请刷新页面。</p>))
} else if (new URLSearchParams(window.location.search).get('preview') === 'single-actions') {
  import('./single-actions-preview/SingleActionsAcceptance').then(({ default: SingleActionsAcceptance }) => {
    root.render(<StrictMode><SingleActionsAcceptance /></StrictMode>)
  }).catch(() => root.render(<p role="alert">动作候选预览加载失败，请刷新页面。</p>))
} else if (new URLSearchParams(window.location.search).get('preview') === 'expressions') {
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

