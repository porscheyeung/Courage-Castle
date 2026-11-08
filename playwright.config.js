module.exports = {
  testDir: './tests',
  testMatch: '*.spec.js',
  timeout: 90000,
  workers: 2,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4189', headless: true },
  webServer: {
    command: 'python3 -m http.server 4189 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4189',
    reuseExistingServer: true,
  },
};
