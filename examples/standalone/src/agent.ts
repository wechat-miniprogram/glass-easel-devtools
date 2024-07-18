import * as agent from 'glass-easel-devtools-agent'

// init agent
const devTools = agent.getDevTools(Reflect.get(window, '__agentEnd'))
Reflect.set(window, '__glassEaselDevTools__', devTools)
