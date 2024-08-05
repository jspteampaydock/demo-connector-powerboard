// post-deployment.js
const { setupExtensionResources } = require('./setup');

async function postDeployment() {
  try {
    await setupExtensionResources();
  } catch (error) {
    console.error('Post-deployment: Failed to execute setupExtensionResources', error);
  }
}

postDeployment();
