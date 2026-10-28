/**
 * Entry point: The Object Detective (Lantern Museum, fictional framing; real
 * CC0 Smithsonian 3D scans).
 * @module main
 */
import './styles/site.css';
import './styles/case-fonts.css';
import './v2/hud-shell.css';
import { App } from './app.js';

const app = new App();
// Test hooks only in builds made with VITE_TEST_HOOKS=1 (release builds omit them).
if (__TEST_HOOKS__) window.__app = app;
