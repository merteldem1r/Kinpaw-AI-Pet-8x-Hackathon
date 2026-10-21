/**
 * Tabs layout — My pet · Friends · Profile · Settings (docs/application/product.md,
 * "Structure and scope"; Friends since v2, features/v2-friends-requirements.md, R1). Add a tab by creating
 * app/(tabs)/<name>.tsx, a <Tabs.Screen> below with its label and icon, and its
 * name in TAB_EVENT_NAMES (components/TabBar.tsx). The floating TabBar draws
 * whatever is registered here; tab screens clear it with useTabBarClearance()
 * (the Screen primitive does this when given `tabs`).
 */
import { Tabs } from 'expo-router'
import { PawPrint, Settings, User, Users } from 'lucide-react-native'
import TabBar from '@/components/TabBar'
import { useColors } from '@/contexts/ThemeContext'

const STROKE = 1.9

export default function TabsLayout() {
	const c = useColors()
	return (
		<Tabs
			tabBar={(props) => <TabBar {...props} />}
			screenOptions={{
				headerShown: false,
				sceneStyle: { backgroundColor: c.bg },
				animation: 'fade',
				freezeOnBlur: true
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					tabBarLabel: 'My pet',
					tabBarIcon: ({ color, size }) => (
						<PawPrint size={size} color={color} strokeWidth={STROKE} />
					)
				}}
			/>
			<Tabs.Screen
				name="friends"
				options={{
					tabBarLabel: 'Friends',
					tabBarIcon: ({ color, size }) => <Users size={size} color={color} strokeWidth={STROKE} />
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					tabBarLabel: 'Profile',
					tabBarIcon: ({ color, size }) => <User size={size} color={color} strokeWidth={STROKE} />
				}}
			/>
			<Tabs.Screen
				name="settings"
				options={{
					tabBarLabel: 'Settings',
					tabBarIcon: ({ color, size }) => (
						<Settings size={size} color={color} strokeWidth={STROKE} />
					)
				}}
			/>
		</Tabs>
	)
}
