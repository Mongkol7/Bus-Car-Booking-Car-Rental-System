import { defineConfig, transformWithOxc } from 'vite'
import react from '@vitejs/plugin-react'

const jsxInJsFiles = [
  '/src/features/checkout/passenger/PassengerInfoForm.js',
  '/src/features/rental/booking-form/RentalBookingForm.js',
]

const reactJsFilesAsJsx = {
  name: 'react-js-files-as-jsx',
  enforce: 'pre',
  transform(code, id) {
    const normalizedId = id.replaceAll('\\', '/')

    if (!jsxInJsFiles.some((filePath) => normalizedId.endsWith(filePath))) {
      return null
    }

    return transformWithOxc(code, id, {
      lang: 'jsx',
      jsx: {
        runtime: 'automatic',
      },
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [reactJsFilesAsJsx, react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})


