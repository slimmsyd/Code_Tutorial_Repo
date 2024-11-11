import logging
import json
import os
from flask_cors import CORS
from flask import (
    Flask,
    request,
    jsonify
)
from autogen import AssistantAgent, UserProxyAgent, GroupChat, GroupChatManager



app = Flask(__name__);

CORS(app);



@app.route("/analyze", methods=["POST"])
def analyze():
    try: 
        logging.info("Starting analyze endpoint")
        
        # Log raw request data
        logging.info(f"Request data: {request.data}")
        logging.info(f"Request headers: {request.headers}")
        
        try:
            req_body = request.get_json()
            logging.info(f"Parsed request body: {req_body}")
        except Exception as json_error:
            logging.error(f"JSON parsing error: {str(json_error)}")
            return jsonify({"error": "Invalid JSON in request body"}), 400
            
        OPEN_AI_KEY = os.getenv("OPENAI_API_KEY");
        if not OPEN_AI_KEY:
            raise Exception("OPENAI_API_KEY is not set");
        
        ocr_text = req_body.get("ocr_text")
        if not ocr_text:
            return jsonify({"error": "ocr_text is required"}), 400
        
        # Define the LLM configuration 
        config_list = [
            {
                "model": "gpt-4",  # Changed from gpt-4o-mini to gpt-4
                "api_key": OPEN_AI_KEY
            }
        ]
        
        user_proxy = UserProxyAgent(
            name="user_proxy",
            system_message="A proxy for the user to help coordinate the data processing task.",
            code_execution_config=False
        )
        
        data_validation_agent = AssistantAgent(
            name="data_validator", 
            system_message="Validate and clean the input data, checking for any inconsistencies or errors.",
            llm_config={"config_list": config_list}
        )
        
        data_formatter = AssistantAgent(
            name="data_formatter", 
            system_message="Format the validated data into the required structure. Prefix the final response with 'FINAL_RESPONSE:'",
            llm_config={"config_list": config_list}
        )
        
        groupchat = GroupChat(
            agents=[user_proxy, data_validation_agent, data_formatter],
            messages=[],
            max_round=2
        )
        
        manager = GroupChatManager(groupchat=groupchat)
        
        # Process the text - Fixed the message format
        user_proxy.initiate_chat(
            manager,
            message=f"Process this event text: {ocr_text}"
        )
        
        # Get the last message from the data formatter
        result = manager.last_message(agent=data_formatter)["content"]
        if "FINAL_RESPONSE:" in result:
            result = result.replace("FINAL_RESPONSE:", "").strip()
        
        return jsonify({"result": result})
        
    except Exception as e:
        logging.error(f"Error in analyze endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500
        
        
        
        
        
if __name__ == "__main__":
    app.run(debug=True, port=5000);