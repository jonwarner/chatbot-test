import React from 'react';
import {
  SafeAreaView,
  StyleSheet,StatusBar,
  Alert
} from 'react-native';

import voiceLibs from 'aws-amplify-react-native/dist/Interactions/ReactNativeModules'
import { ChatBot, withAuthenticator } from 'aws-amplify-react-native';
import { Interactions } from 'aws-amplify';


interface BotConfig {
  [key: string]: Object;
}

const App = () => {
  const botName = 'InterviewEightBot';
  const helpText = 'To start the interview, tap the mic button and say "Start interview!"';
  const botConfig: BotConfig = {};
  botConfig[botName] = { name: botName, alias: "$LATEST", region: "us-east-1" };
  Interactions.configure({ bots: botConfig });
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.container}>
        <ChatBot
          botName={botName}
          welcomeMessage={helpText}
          onComplete={() => Alert.alert("All done!")}
          clearOnComplete={false}
          styles={StyleSheet.create({
              itemMe: {
                  color: 'blue'
              }
          })}
          voiceEnabled={true}
          voiceLibs={voiceLibs}
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
