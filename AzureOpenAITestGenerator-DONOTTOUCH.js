var AzureOpenAITestGenerator = Class.create();
AzureOpenAITestGenerator.prototype = {
    
    initialize: function() {
        gs.info('==========================================');
        gs.info('AzureOpenAITestGenerator: Initializing...');
        gs.info('==========================================');
        
        this.endpoint = gs.getProperty('azure.openai.endpoint');
        this.deployment = gs.getProperty('azure.openai.deployment');
        this.apiVersion = gs.getProperty('azure.openai.api.version');
        this.apiKey = gs.getProperty('azure.openai.apikey');
        
        gs.info('Configuration:');
        gs.info('  - Endpoint: ' + (this.endpoint || '(not set)'));
        gs.info('  - Deployment: ' + (this.deployment || '(not set)'));
        gs.info('  - API Version: ' + (this.apiVersion || '(not set)'));
        gs.info('  - API Key: ' + (this.apiKey ? this.apiKey.length + ' chars' : '(not set)'));
        
        var configValid = true;
        if (!this.endpoint) { gs.error('❌ azure.openai.endpoint not set'); configValid = false; }
        if (!this.deployment) { gs.error('❌ azure.openai.deployment not set'); configValid = false; }
        if (!this.apiVersion) { gs.error('❌ azure.openai.api.version not set'); configValid = false; }
        if (!this.apiKey) { gs.error('❌ azure.openai.apikey not set'); configValid = false; }
        
        if (configValid) {
            gs.info('✅ Configuration is valid');
        }
        
        gs.info('==========================================');
    },

    generateTestCasesFromStory: function(storyId, numTestCases, options) {
        gs.info('');
        gs.info('██████████████████████████████████████████████████████████████');
        gs.info('█  START: GENERATE TEST CASES FROM USER STORY                █');
        gs.info('██████████████████████████████████████████████████████████████');
        gs.info('');
        
        var startTime = new GlideDateTime();
        gs.info('Start Time: ' + startTime.getDisplayValue());
        gs.info('Input: storyId=' + storyId + ', numTestCases=' + numTestCases);
        gs.info('Options: ' + JSON.stringify(options || {}, null, 2));
        
        options = options || {};
        numTestCases = numTestCases || 5;
        
        gs.info('');
        gs.info('─────────────────────────────────────────────────────────────');
        gs.info('STEP 1: Retrieving User Story');
        gs.info('─────────────────────────────────────────────────────────────');
        
        var story = new GlideRecord('rm_story');
        if (!story.get(storyId)) {
            gs.error('❌ Story not found: ' + storyId);
            return {success: false, message: 'Story not found', count: 0};
        }
        
        gs.info('✅ Story found: ' + story.getValue('short_description'));
        gs.info('Description: ' + story.getValue('description'));
		gs.info('Acceptance Criteria: ' + story.getValue('acceptance_criteria'));
        
        gs.info('');
        gs.info('─────────────────────────────────────────────────────────────');
        gs.info('STEP 2: Building AI Prompt');
        gs.info('─────────────────────────────────────────────────────────────');
        
        var prompt = this._buildPrompt(story, numTestCases, options);
        gs.info('Prompt length: ' + prompt.length + ' characters');
        gs.info('');
        gs.info('===== FULL PROMPT =====');
        gs.info(prompt);
        gs.info('===== END PROMPT =====');
        
        gs.info('');
        gs.info('─────────────────────────────────────────────────────────────');
        gs.info('STEP 3: Calling Azure OpenAI API');
        gs.info('─────────────────────────────────────────────────────────────');
        
        var aiResponse = this._callAzureOpenAI(prompt);
        
        if (!aiResponse.success) {
            gs.error('❌ AI call failed: ' + aiResponse.message);
            return aiResponse;
        }
        
        gs.info('✅ AI response received');
        gs.info('Content length: ' + aiResponse.content.length);
        gs.info('Tokens used: ' + JSON.stringify(aiResponse.tokens_used));
        gs.info('');
        gs.info('===== RAW AI RESPONSE =====');
        gs.info(aiResponse.content);
        gs.info('===== END RAW RESPONSE =====');
        
        gs.info('');
        gs.info('─────────────────────────────────────────────────────────────');
        gs.info('STEP 4: Parsing AI Response');
        gs.info('─────────────────────────────────────────────────────────────');
        
        var parsedData = this._parseAIResponse(aiResponse.content);
        
        if (!parsedData.success) {
            gs.error('❌ Parse failed: ' + parsedData.message);
            return parsedData;
        }
        
        gs.info('✅ Parse successful');
        gs.info('Test Set Name: ' + parsedData.test_set_name);
        gs.info('Test Cases Count: ' + parsedData.test_cases.length);
        
        gs.info('');
        gs.info('─────────────────────────────────────────────────────────────');
        gs.info('STEP 5: Creating Test Cases in ServiceNow');
        gs.info('─────────────────────────────────────────────────────────────');
        
        var created = this._createTestCases(parsedData.test_cases, storyId, story, parsedData.test_set_name);
        
        var endTime = new GlideDateTime();
        
        gs.info('');
        gs.info('██████████████████████████████████████████████████████████████');
        if (created > 0) {
            gs.info('█  ✅ SUCCESS: ' + created + ' TEST CASES CREATED                   █');
        } else {
            gs.error('█  ❌ FAILED: NO TEST CASES CREATED                          █');
        }
        gs.info('██████████████████████████████████████████████████████████████');
        gs.info('Summary:');
        gs.info('  - Requested: ' + numTestCases);
        gs.info('  - Parsed: ' + parsedData.test_cases.length);
        gs.info('  - Created: ' + created);
        gs.info('  - Start: ' + startTime.getDisplayValue());
        gs.info('  - End: ' + endTime.getDisplayValue());
        gs.info('');
        
        return {
            success: created > 0,
            message: 'Created ' + created + ' test case' + (created !== 1 ? 's' : ''),
            count: created
        };
    },

    _buildPrompt: function(story, numTestCases, options) {
        gs.info('Building prompt...');
        
        var prompt = "";
        prompt += "Convert the following requirement into STRICT JSON for ServiceNow Test Management 2.0.\n\n";
        
        prompt += "CRITICAL RULES:\n";
        prompt += "- Output MUST be valid JSON only\n";
        prompt += "- NO markdown code blocks (no ```json or ```)\n";
        prompt += "- NO explanations, comments, or extra text\n";
        prompt += "- Start with { and end with }\n";
        prompt += "- Use EXACT field names as specified in schema\n";
        prompt += "- Generate " + numTestCases + " test cases\n\n";
        
        if (options.includeNegative) {
            prompt += "- Include negative test scenarios\n";
            gs.info('  * Including negative scenarios');
        }
        if (options.includeBoundary) {
            prompt += "- Include boundary value tests\n";
            gs.info('  * Including boundary tests');
        }
        if (options.testType) {
            prompt += "- Focus on " + options.testType + " testing\n";
            gs.info('  * Focus: ' + options.testType);
        }
        
        prompt += "\nFIELD MAPPING REFERENCE:\n";
        prompt += "┌─────────────────────────────────────────────────────────┐\n";
        prompt += "│ JSON Field              → ServiceNow Table.Field        │\n";
        prompt += "├─────────────────────────────────────────────────────────┤\n";
        prompt += "│ test_set.name           → test_set.name                 │\n";
        prompt += "│ test_cases[].short_description → test_version.short_description │\n";
        prompt += "│ test_cases[].priority   → test_version.priority        │\n";
        prompt += "│ test_cases[].steps[].order → step.order                │\n";
        prompt += "│ test_cases[].steps[].action → step.description         │\n";
        prompt += "└─────────────────────────────────────────────────────────┘\n\n";
        
        prompt += "EXACT JSON SCHEMA (use these field names exactly):\n";
        prompt += "{\n";
        prompt += "  \"test_set\": {\n";
        prompt += "    \"name\": \"Test Set Name Here\"\n";
        prompt += "  },\n";
        prompt += "  \"test_cases\": [\n";
        prompt += "    {\n";
        prompt += "      \"short_description\": \"Brief test case name\",\n";
        prompt += "      \"priority\": \"High\",\n";
        prompt += "      \"steps\": [\n";
        prompt += "        {\n";
        prompt += "          \"order\": 1,\n";
        prompt += "          \"action\": \"Imperative verb action description\"\n";
        prompt += "        },\n";
        prompt += "        {\n";
        prompt += "          \"order\": 2,\n";
        prompt += "          \"action\": \"Next action\"\n";
        prompt += "        }\n";
        prompt += "      ]\n";
        prompt += "    }\n";
        prompt += "  ]\n";
        prompt += "}\n\n";
        
        prompt += "EXAMPLE OUTPUT:\n";
        prompt += "{\n";
        prompt += "  \"test_set\": {\"name\": \"Login Feature Test Set\"},\n";
        prompt += "  \"test_cases\": [\n";
        prompt += "    {\n";
        prompt += "      \"short_description\": \"Verify successful login with valid credentials\",\n";
        prompt += "      \"priority\": \"High\",\n";
        prompt += "      \"steps\": [\n";
        prompt += "        {\"order\": 1, \"action\": \"Navigate to login page\"},\n";
        prompt += "        {\"order\": 2, \"action\": \"Enter valid username\"},\n";
        prompt += "        {\"order\": 3, \"action\": \"Enter valid password\"},\n";
        prompt += "        {\"order\": 4, \"action\": \"Click Login button\"}\n";
        prompt += "      ]\n";
        prompt += "    }\n";
        prompt += "  ]\n";
        prompt += "}\n\n";
        
        prompt += "INPUT USER STORY:\n";
        prompt += "Title: " + story.getValue('short_description') + "\n";
        prompt += "Description: " + story.getValue('description') + "\n\n";
        
        prompt += "NOW GENERATE THE JSON (remember: no markdown, just pure JSON):\n";
        
        gs.info('Prompt built successfully');
        return prompt;
    },

    _callAzureOpenAI: function(prompt) {
        gs.info('Calling Azure OpenAI...');
        gs.info('Endpoint: ' + this.endpoint);
        gs.info('Deployment: ' + this.deployment);
        
        try {
            var request = new sn_ws.RESTMessageV2('Azure OpenAI Chat Completion', 'generate_completion');
            
            gs.info('Setting parameters...');
            request.setStringParameterNoEscape('endpoint', this.endpoint);
            request.setStringParameterNoEscape('deployment', this.deployment);
            request.setStringParameterNoEscape('api_version', this.apiVersion);
            request.setStringParameterNoEscape('api_key', this.apiKey);
            
            var requestBody = {
                messages: [
                    {
                        role: "system",
                        content: "You are a test case generator. You MUST return ONLY valid JSON. Never include markdown code blocks, explanations, or any text outside the JSON. Start with { and end with }. Use the exact field names provided in the schema."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 4000,
                top_p: 0.95
            };
            
            gs.info('Request config:');
            gs.info('  - Temperature: ' + requestBody.temperature);
            gs.info('  - Max tokens: ' + requestBody.max_tokens);
            
            request.setStringParameterNoEscape('request_body', JSON.stringify(requestBody));
            
            gs.info('Sending request...');
            var response = request.execute();
            var httpStatus = response.getStatusCode();
            
            gs.info('Response status: ' + httpStatus);
            
            if (httpStatus != 200) {
                var errorBody = response.getBody();
                gs.error('HTTP error: ' + errorBody);
                return {success: false, message: 'HTTP ' + httpStatus, error_details: errorBody};
            }
            
            var jsonResponse = JSON.parse(response.getBody());
            var content = jsonResponse.choices[0].message.content;
            
            gs.info('✅ Response received');
            gs.info('Content length: ' + content.length);
            
            if (jsonResponse.usage) {
                gs.info('Token usage:');
                gs.info('  - Prompt: ' + jsonResponse.usage.prompt_tokens);
                gs.info('  - Completion: ' + jsonResponse.usage.completion_tokens);
                gs.info('  - Total: ' + jsonResponse.usage.total_tokens);
            }
            
            return {
                success: true,
                content: content,
                tokens_used: jsonResponse.usage || {}
            };
            
        } catch (ex) {
            gs.error('❌ Exception: ' + ex.message);
            gs.error('Stack: ' + (ex.stack || 'not available'));
            return {success: false, message: 'Exception: ' + ex.message};
        }
    },

_parseAIResponse: function(content) {
        gs.info('Parsing AI response...');
        gs.info('Original content length: ' + content.length);
        
        var cleaned = content.trim();
        
        gs.info('Removing markdown...');
        cleaned = cleaned.replace(/```json\s*/g, '');
        cleaned = cleaned.replace(/```\s*/g, '');
        cleaned = cleaned.trim();
        
        gs.info('Finding JSON boundaries...');
        var jsonStart = cleaned.indexOf('{');
        var jsonEnd = cleaned.lastIndexOf('}');
        
        if (jsonStart === -1 || jsonEnd === -1) {
            gs.error('❌ No JSON object found');
            gs.error('Content: ' + cleaned.substring(0, 500));
            return {success: false, message: 'No JSON object found in response'};
        }
        
        if (jsonStart > 0) {
            gs.info('Removing ' + jsonStart + ' chars before JSON');
            cleaned = cleaned.substring(jsonStart);
        }
        
        if (jsonEnd < cleaned.length - 1) {
            gs.info('Removing ' + (cleaned.length - jsonEnd - 1) + ' chars after JSON');
            cleaned = cleaned.substring(0, jsonEnd + 1);
        }
        
        gs.info('Cleaned content length: ' + cleaned.length);
        gs.info('');
        gs.info('===== CLEANED JSON =====');
        gs.info(cleaned);
        gs.info('===== END CLEANED JSON =====');
        gs.info('');
        
        try {
            gs.info('Parsing JSON...');
            var parsed = JSON.parse(cleaned);
            
            gs.info('✅ JSON parsed successfully');
            gs.info('');
            gs.info('===== PARSED STRUCTURE =====');
            gs.info(JSON.stringify(parsed, null, 2));
            gs.info('===== END PARSED STRUCTURE =====');
            gs.info('');
            
            if (!parsed.test_set) {
                gs.error('❌ Missing "test_set" field');
                return {success: false, message: 'Missing test_set field'};
            }
            
            if (!parsed.test_cases) {
                gs.error('❌ Missing "test_cases" field');
                return {success: false, message: 'Missing test_cases field'};
            }
            
            if (!Array.isArray(parsed.test_cases)) {
                gs.error('❌ "test_cases" is not an array');
                return {success: false, message: 'test_cases is not an array'};
            }
            
            gs.info('Inspecting test cases...');
            for (var i = 0; i < parsed.test_cases.length; i++) {
                var tc = parsed.test_cases[i];
                gs.info('');
                gs.info('Test Case #' + (i + 1) + ' inspection:');
                gs.info('  Keys: ' + Object.keys(tc).join(', '));
                gs.info('  short_description: "' + (tc.short_description || '(MISSING)') + '"');
                gs.info('  priority: "' + (tc.priority || '(not set)') + '"');
                gs.info('  steps: ' + (tc.steps ? 'array[' + tc.steps.length + ']' : '(MISSING)'));
                
                if (tc.steps && Array.isArray(tc.steps)) {
                    for (var j = 0; j < Math.min(tc.steps.length, 3); j++) {
                        var step = tc.steps[j];
                        gs.info('    Step ' + (j + 1) + ': order=' + step.order + ', action="' + (step.action || '').substring(0, 50) + '"');
                    }
                    if (tc.steps.length > 3) {
                        gs.info('    ... and ' + (tc.steps.length - 3) + ' more steps');
                    }
                }
                
                if (!tc.short_description) {
                    gs.warn('⚠️  Test case #' + (i + 1) + ' missing short_description!');
                }
            }
            
            return {
                success: true,
                test_set_name: parsed.test_set.name || 'Generated Test Set',
                test_cases: parsed.test_cases
            };
            
        } catch (ex) {
            gs.error('❌ JSON parse error: ' + ex.message);
            gs.error('Failed content (first 500 chars):');
            gs.error(cleaned.substring(0, 500));
            return {success: false, message: 'JSON parse error: ' + ex.message};
        }
    },

    _createTestCases: function(testCases, storyId, story, testSetName) {
        gs.info('Creating test cases in ServiceNow...');
        gs.info('Number to create: ' + testCases.length);
        
        var successCount = 0;
        var failureCount = 0;
        
        var testSetId = null;
        if (testSetName) {
            gs.info('');
            gs.info('Creating/finding test set: "' + testSetName + '"');
            testSetId = this._createOrFindTestSet(testSetName, storyId);
            if (testSetId) {
                gs.info('✅ Test set ready: ' + testSetId);
            } else {
                gs.warn('⚠️  Test set creation failed');
            }
        }
        
        for (var i = 0; i < testCases.length; i++) {
            var tc = testCases[i];
            
            gs.info('');
            gs.info('═══════════════════════════════════════════════════════════');
            gs.info('Creating Test Case ' + (i + 1) + '/' + testCases.length);
            gs.info('═══════════════════════════════════════════════════════════');
            gs.info('Input data:');
            gs.info(JSON.stringify(tc, null, 2));
            
            try {
                var shortDescription = tc.short_description || 'Generated Test Case ' + (i + 1);
                var priority = this._mapPriority(tc.priority || 'Medium');
                
                gs.info('');
                gs.info('Field mapping:');
                gs.info('  JSON short_description: "' + (tc.short_description || '(not provided)') + '"');
                gs.info('  → DB short_description: "' + shortDescription + '"');
                gs.info('  JSON priority: "' + (tc.priority || '(not provided)') + '"');
                gs.info('  → DB priority: "' + priority + '"');
                
                if (!tc.short_description) {
                    gs.warn('⚠️  Using fallback for short_description');
                }
                
                var testVersion = new GlideRecord('sn_test_management_test_version');
                testVersion.initialize();
                testVersion.setValue('short_description', shortDescription);
                testVersion.setValue('priority', priority);
                testVersion.setValue('state', 'Draft');
                
                if (testVersion.isValidField('story')) {
                    testVersion.setValue('story', storyId);
                    gs.info('  → Linked to story: ' + storyId);
                }
                
                gs.info('');
                gs.info('Inserting test version...');
                var testVersionId = testVersion.insert();
                
                if (!testVersionId) {
                    failureCount++;
                    gs.error('❌ Insert failed');
                    gs.error('Error: ' + testVersion.getLastErrorMessage());
                    continue;
                }
                
                gs.info('✅ Test version created: ' + testVersionId);
                gs.info('   Number: ' + testVersion.getValue('number'));
                successCount++;
                
                if (tc.steps && Array.isArray(tc.steps) && tc.steps.length > 0) {
                    gs.info('');
                    gs.info('Creating ' + tc.steps.length + ' steps...');
                    var stepsCreated = this._createTestSteps(testVersionId, tc.steps);
                    gs.info('Steps: ' + stepsCreated + '/' + tc.steps.length + ' created');
                } else {
                    gs.warn('⚠️  No steps found');
                }
                
                if (testSetId) {
                    gs.info('Linking to test set...');
                    this._linkTestVersionToTestSet(testVersionId, testSetId);
                }
                
                gs.info('✅ Test case ' + (i + 1) + ' complete');
                
            } catch (ex) {
                failureCount++;
                gs.error('❌ Exception: ' + ex.message);
                gs.error('Stack: ' + (ex.stack || 'not available'));
            }
        }
        
        gs.info('');
        gs.info('═══════════════════════════════════════════════════════════');
        gs.info('CREATION SUMMARY');
        gs.info('═══════════════════════════════════════════════════════════');
        gs.info('Total: ' + testCases.length);
        gs.info('Created: ' + successCount);
        gs.info('Failed: ' + failureCount);
        gs.info('Success Rate: ' + (testCases.length > 0 ? Math.round((successCount/testCases.length)*100) : 0) + '%');
        
        return successCount;
    },

    _createOrFindTestSet: function(testSetName, storyId) {
        gs.info('Looking for test set: "' + testSetName + '"');
        
        try {
            var testSet = new GlideRecord('sn_test_management_test_set');
            testSet.addQuery('name', testSetName);
            testSet.query();
            
            if (testSet.next()) {
                gs.info('✅ Found existing: ' + testSet.sys_id);
                return testSet.sys_id.toString();
            }
            
            gs.info('Creating new test set...');
            testSet = new GlideRecord('sn_test_management_test_set');
            testSet.initialize();
            testSet.setValue('name', testSetName);
            testSet.setValue('state', 'Draft');
            
            var testSetId = testSet.insert();
            
            if (testSetId) {
                gs.info('✅ Created: ' + testSetId);
                return testSetId.toString();
            } else {
                gs.error('❌ Creation failed');
                return null;
            }
            
        } catch (ex) {
            gs.error('❌ Exception: ' + ex.message);
            return null;
        }
    },
    _linkTestVersionToTestSet: function(testVersionId, testSetId) {
        gs.info('Creating relationship between test version and test set...');
        gs.info('  test_version: ' + testVersionId);
        gs.info('  test_set: ' + testSetId);
        
        try {
            // Correct table name for Test Management 2.0
            var rel = new GlideRecord('sn_test_management_m2m_test_set_test');
            
            if (!rel.isValid()) {
                gs.error('❌ Table sn_test_management_m2m_test_set_test does not exist');
                return false;
            }
            
            rel.initialize();
            
            // Check what fields exist
            gs.info('Available fields on relationship table:');
            var fields = rel.getFields();
            for (var i = 0; i < fields.size(); i++) {
                var field = fields.get(i);
                gs.info('  - ' + field.getName());
            }
            
            // The table likely uses 'test_set' and 'test' fields
            // Let's try both possibilities
            
            if (rel.isValidField('test_set') && rel.isValidField('test')) {
                gs.info('Using fields: test_set and test');
                rel.setValue('test_set', testSetId);
                rel.setValue('test', testVersionId);
            } else if (rel.isValidField('test_set') && rel.isValidField('test_version')) {
                gs.info('Using fields: test_set and test_version');
                rel.setValue('test_set', testSetId);
                rel.setValue('test_version', testVersionId);
            } else {
                gs.error('❌ Could not determine correct field names');
                gs.error('Please check the table schema');
                return false;
            }
            
            gs.info('Inserting relationship record...');
            var relId = rel.insert();
            
            if (relId) {
                gs.info('✅ Relationship created successfully: ' + relId);
                return true;
            } else {
                gs.error('❌ Insert failed');
                gs.error('Error: ' + rel.getLastErrorMessage());
                return false;
            }
            
        } catch (ex) {
            gs.error('❌ Exception: ' + ex.message);
            gs.error('Stack: ' + (ex.stack || 'not available'));
            return false;
        }
    },

    _createTestSteps: function(testVersionId, steps) {
        gs.info('════════════════════════════════════════════════════════════');
        gs.info('CREATING TEST STEPS');
        gs.info('════════════════════════════════════════════════════════════');
        gs.info('Test Version ID: ' + testVersionId);
        gs.info('Steps parameter type: ' + typeof steps);
        gs.info('Steps is null: ' + (steps === null));
        gs.info('Steps is undefined: ' + (steps === undefined));
        
        // Validate testVersionId
        if (!testVersionId || testVersionId === null || testVersionId === undefined || testVersionId === '') {
            gs.error('❌ testVersionId is invalid: ' + testVersionId);
            return 0;
        }
        gs.info('✅ testVersionId is valid: ' + testVersionId);
        
        // Validate steps parameter
        if (steps === null) {
            gs.error('❌ steps parameter is null');
            return 0;
        }
        
        if (steps === undefined) {
            gs.error('❌ steps parameter is undefined');
            return 0;
        }
        
        if (!Array.isArray(steps)) {
            gs.error('❌ steps is not an array, type: ' + typeof steps);
            gs.error('Steps value: ' + steps);
            return 0;
        }
        
        gs.info('✅ steps is a valid array');
        gs.info('Number of steps in array: ' + steps.length);
        
        if (steps.length === 0) {
            gs.warn('⚠️  steps array is empty - no steps to create');
            return 0;
        }
        
        // Log the raw array to see what we're dealing with
        gs.info('');
        gs.info('Raw steps array content:');
        try {
            gs.info(JSON.stringify(steps, null, 2));
        } catch (jsonEx) {
            gs.error('Could not stringify steps array: ' + jsonEx.message);
            gs.info('Steps array toString: ' + steps.toString());
        }
        gs.info('');
        
        // Verify table exists
        try {
            var testTable = new GlideRecord('sn_test_management_step');
            if (!testTable.isValid()) {
                gs.error('❌ sn_test_management_step table does not exist');
                return 0;
            }
            gs.info('✅ Table sn_test_management_step is valid');
        } catch (tableEx) {
            gs.error('❌ Exception checking table: ' + tableEx.message);
            return 0;
        }
        
        var stepsCreated = 0;
        var stepsSkipped = 0;
        var stepsFailed = 0;
        
        // Process each step with extensive null checking
        for (var i = 0; i < steps.length; i++) {
            gs.info('');
            gs.info('─────────────────────────────────────────────────────────');
            gs.info('Processing Step Index: ' + i + ' (of ' + steps.length + ')');
            gs.info('─────────────────────────────────────────────────────────');
            
            var step = null;
            
            try {
                step = steps[i];
                
                // Check if step is null or undefined
                if (step === null) {
                    gs.warn('⚠️  Step at index ' + i + ' is NULL - skipping');
                    stepsSkipped++;
                    continue;
                }
                
                if (step === undefined) {
                    gs.warn('⚠️  Step at index ' + i + ' is UNDEFINED - skipping');
                    stepsSkipped++;
                    continue;
                }
                
                // Check if step is an object
                if (typeof step !== 'object') {
                    gs.warn('⚠️  Step at index ' + i + ' is not an object, type: ' + typeof step);
                    gs.warn('   Value: ' + step);
                    stepsSkipped++;
                    continue;
                }
                
                gs.info('✅ Step ' + (i + 1) + ' is a valid object');
                gs.info('Step type: ' + typeof step);
                
                // Try to get keys
                var stepKeys = null;
                try {
                    stepKeys = Object.keys(step);
                    gs.info('Step keys: ' + stepKeys.join(', '));
                } catch (keysEx) {
                    gs.error('Could not get keys from step: ' + keysEx.message);
                    stepsSkipped++;
                    continue;
                }
                
                // Try to stringify
                try {
                    gs.info('Step data: ' + JSON.stringify(step));
                } catch (stringifyEx) {
                    gs.warn('Could not stringify step: ' + stringifyEx.message);
                }
                
                // Extract values with null checks
                var order = null;
                var action = null;
                
                try {
                    // Get order value
                    if (step.hasOwnProperty('order') && step.order !== null && step.order !== undefined) {
                        order = step.order;
                        gs.info('✅ Found order field: ' + order);
                    } else if (step.hasOwnProperty('Order') && step.Order !== null && step.Order !== undefined) {
                        order = step.Order;
                        gs.info('✅ Found Order field: ' + order);
                    } else {
                        order = (i + 1) * 100;
                        gs.info('ℹ️  No order field, using calculated: ' + order);
                    }
                    
                    // Get action value
                    if (step.hasOwnProperty('action') && step.action !== null && step.action !== undefined) {
                        action = String(step.action);
                        gs.info('✅ Found action field: "' + action.substring(0, 50) + '"');
                    } else if (step.hasOwnProperty('Action') && step.Action !== null && step.Action !== undefined) {
                        action = String(step.Action);
                        gs.info('✅ Found Action field: "' + action.substring(0, 50) + '"');
                    } else if (step.hasOwnProperty('description') && step.description !== null && step.description !== undefined) {
                        action = String(step.description);
                        gs.info('ℹ️  Using description field: "' + action.substring(0, 50) + '"');
                    } else {
                        action = 'Step ' + (i + 1);
                        gs.warn('⚠️  No action/description field, using default: "' + action + '"');
                    }
                    
                } catch (extractEx) {
                    gs.error('❌ Exception extracting values: ' + extractEx.message);
                    stepsSkipped++;
                    continue;
                }
                
                // Validate extracted values
                if (order === null || order === undefined) {
                    gs.warn('⚠️  Order is null/undefined, using fallback');
                    order = (i + 1) * 100;
                }
                
                if (action === null || action === undefined || action === '') {
                    gs.warn('⚠️  Action is empty, using fallback');
                    action = 'Step ' + (i + 1);
                }
                
                gs.info('');
                gs.info('Final values to insert:');
                gs.info('  test (FK): ' + testVersionId);
                gs.info('  order: ' + order);
                gs.info('  description: "' + action.substring(0, 100) + '"');
                
                // Create the step record
                gs.info('');
                gs.info('Creating GlideRecord...');
                var testStep = new GlideRecord('sn_test_management_step');
                testStep.initialize();
                
                gs.info('Setting field values...');
                testStep.setValue('test', testVersionId);
                testStep.setValue('order', order);
                testStep.setValue('description', action);
                
                gs.info('Inserting record...');
                var stepId = testStep.insert();
                
                if (stepId) {
                    gs.info('✅ SUCCESS: Step created with sys_id: ' + stepId);
                    stepsCreated++;
                } else {
                    gs.error('❌ FAILED: Insert returned null');
                    gs.error('   Error message: ' + testStep.getLastErrorMessage());
                    stepsFailed++;
                }
                
            } catch (stepEx) {
                gs.error('');
                gs.error('❌ EXCEPTION processing step ' + (i + 1));
                gs.error('   Exception type: ' + stepEx.name);
                gs.error('   Exception message: ' + stepEx.message);
                gs.error('   Line number: ' + (stepEx.lineNumber || 'unknown'));
                
                if (stepEx.stack) {
                    gs.error('   Stack trace:');
                    gs.error(stepEx.stack);
                }
                
                gs.error('   Step value at time of exception:');
                try {
                    gs.error('   ' + JSON.stringify(step));
                } catch (ex2) {
                    gs.error('   Could not stringify step: ' + step);
                }
                
                stepsFailed++;
            }
        }
        
        gs.info('');
        gs.info('════════════════════════════════════════════════════════════');
        gs.info('STEP CREATION SUMMARY');
        gs.info('════════════════════════════════════════════════════════════');
        gs.info('Total steps in array: ' + steps.length);
        gs.info('Successfully created: ' + stepsCreated);
        gs.info('Skipped (null/invalid): ' + stepsSkipped);
        gs.info('Failed (errors): ' + stepsFailed);
        
        if (steps.length > 0) {
            gs.info('Success rate: ' + Math.round((stepsCreated/steps.length)*100) + '%');
        }
        
        gs.info('════════════════════════════════════════════════════════════');
        gs.info('');
        
        return stepsCreated;
    },

    _mapPriority: function(priority) {
        gs.info('Mapping priority: "' + priority + '"');
        
        var map = {
            'High': 'High',
            'high': 'High',
            'HIGH': 'High',
            '1': 'High',
            '1-Critical': 'High',
            '1-High': 'High',
            'Critical': 'High',
            'critical': 'High',
            'Medium': 'Medium',
            'medium': 'Medium',
            'MEDIUM': 'Medium',
            '2': 'Medium',
            '3': 'Medium',
            '2-Medium': 'Medium',
            '3-Medium': 'Medium',
            'Low': 'Low',
            'low': 'Low',
            'LOW': 'Low',
            '4': 'Low',
            '4-Low': 'Low'
        };
        
        var mapped = map[priority] || 'Medium';
        gs.info('Mapped to: "' + mapped + '"');
        
        return mapped;
    },

    type: 'AzureOpenAITestGenerator'
};
