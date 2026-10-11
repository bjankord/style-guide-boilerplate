import { defineConfig } from 'vite'
import styleGuide from '../../src/index.js'
import options from './options.js'

export default defineConfig({
  root: import.meta.dirname,
  plugins: [styleGuide(options)],
})
