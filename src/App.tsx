import React from 'react';
import {
  SafeAreaView,
  StyleSheet,StatusBar,
  Alert
} from 'react-native';

import { withAuthenticator } from 'aws-amplify-react-native';
import Amplify, { Auth } from 'aws-amplify';

import { ChatBot } from './components';


Amplify.configure({
  Auth: {
    region: 'us-east-1',
    identityPoolId: 'us-east-1:0cd56a01-2b75-4ddc-8904-b7352c29952e',
    userPoolId: 'us-east-1_543qq0FaA',
    userPoolWebClientId: '5a2su7pf41gpmrbvjaam1qgf5a'
  },
  Analytics: {
    disabled: true
  }
});


Amplify.Logger.LOG_LEVEL = 'VERBOSE';


const App = () => {
  const botName = 'InterviewEightBot';
  const helpText = 'To start the interview, tap the mic button and say "Start interview!"';
  
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.container}>
        <ChatBot
          botName={botName}
          welcomeMessage={helpText}
          onComplete={() => Alert.alert("All done!")}
          styles={StyleSheet.create({
              itemMe: {
                  color: 'blue'
              }
          })}
          voiceEnabled={true}
          conversationModeOn={true}
        />
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white'
  }
});

export default withAuthenticator(App);
