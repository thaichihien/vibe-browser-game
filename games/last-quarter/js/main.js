/* Boot. */
import { Sound } from './audio.js';
import { start } from './game.js';

Sound.init();
window.game = start();   // handy for a headless verification pass
