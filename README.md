Build a custom integration with Azure OpenAI 

Architecture Overview

REST Message - Connection to Azure OpenAI
Script Include - Business logic for AI integration
UI Action - Button to trigger generation
//Business Rule (optional) - Automated generation
//Flow Designer (optional) - Visual workflow approach


Step-by-Step Implementation
Step 1: Store Azure OpenAI Credentials
Create System Properties

Navigate to: System Properties > System Properties
Create these properties:
Property 1:

   Name: azure.openai.endpoint
   Value: https://YOUR-RESOURCE.openai.azure.com
   Type: string
   Description: Azure OpenAI Endpoint URL
Property 2:
   Name: azure.openai.deployment
   Value: YOUR-DEPLOYMENT-NAME
   Type: string
   Description: Azure OpenAI Deployment Name (e.g., gpt-4)
Property 3:
   Name: azure.openai.api.version
   Value: 2024-02-15-preview
   Type: string
   Description: Azure OpenAI API Version
Property 4:
  System Property
  Name: azure.openai.apikey
  Value: YOUR-API-KEY
  Type: password
