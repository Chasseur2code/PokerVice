import { render } from 'preact'
import './styles/index.css'
import { App } from './ui/App'

render(<App />, document.getElementById('app')!)
// L'app est affichée : l'écran de chargement d'index.html n'a plus lieu d'être.
document.getElementById('boot')?.remove()
