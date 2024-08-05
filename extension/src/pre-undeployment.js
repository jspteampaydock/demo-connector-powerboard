const { cleanupExtensionResources } = require('./setup');

async function preUndeployment() {
  try {
    await cleanupExtensionResources();
    console.log('Pre-undeployment: cleanupExtensionResources executed successfully.');
  } catch (error) {
    console.error('Pre-undeployment: Failed to execute cleanupExtensionResources', error);
  }
}

preUndeployment();
