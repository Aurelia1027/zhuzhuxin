import { characterExpressions } from '../types/characterExpression.ts'
import { expressionStore, useExpressionStore } from '../stores/expressionStore.ts'

export function CharacterExpressionControls(){
 const state=useExpressionStore()
 return <div className="character-expression-controls">
  <div className="expression-grid" role="group" aria-label="猪猪心表情">{characterExpressions.map(([id,label])=><button type="button" key={id} aria-pressed={state.expression===id} onClick={()=>expressionStore.setManual(id)}>{label}</button>)}</div>
  <button type="button" aria-pressed={state.mode==='ai'} onClick={()=>expressionStore.followChat()}>跟随聊天</button>
  <small role="status">{state.mode==='manual'?'手动表情已锁定；点击“跟随聊天”恢复 AI。':'下一条 AI 回复将更新表情；身体动作独立运行。'}</small>
 </div>
}
