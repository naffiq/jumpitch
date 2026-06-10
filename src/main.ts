import './style.css';
import { App } from './app';

const container = document.getElementById('game-root')!;
const uiRoot = document.getElementById('ui-root')!;

const app = new App(container, uiRoot);
app.start();
