import { AppRegistry, SafeAreaView, StatusBar } from "react-native"
import { NavigationContainer } from "@react-navigation/native"
import { createStackNavigator } from "@react-navigation/stack"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { Ionicons } from "@expo/vector-icons"
import LoginScreen from "./screens/LoginScreen"
import RegisterScreen from "./screens/RegisterScreen"
import HomeScreen from "./screens/HomeScreen"
import ScanDocumentScreen from "./screens/ScanDocumentScreen"
import ProfileScreen from "./screens/ProfileScreen"
import appConfig from "./app.json"
import { Colors } from "./constants/Colors"

const Stack = createStackNavigator()
const Tab = createBottomTabNavigator()

// Main tab navigator for authenticated users
const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName

          if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline"
          } else if (route.name === "Scan") {
            iconName = focused ? "scan" : "scan-outline"
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline"
          }

          return <Ionicons name={iconName as any} size={size} color={color} />
        },
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        headerShown: true,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Dashboard" }} />
      <Tab.Screen
        name="Scan"
        component={ScanDocumentScreen}
        options={{
          title: "Scan Document",
          tabBarLabel: "Scan",
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}

const App = () => (
  <SafeAreaView style={{ flex: 1 }}>
    <StatusBar barStyle="dark-content" backgroundColor="#fff" />
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="Home"
          component={MainTabs}
          options={{
            headerShown: false,
            // Prevent going back to login screen
            headerLeft: () => null,
            gestureEnabled: false,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  </SafeAreaView>
)

AppRegistry.registerComponent(appConfig.expo.name, () => App)

export default App
