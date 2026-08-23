import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  Prompt_400Regular,
  Prompt_500Medium,
  Prompt_600SemiBold,
  Prompt_700Bold,
  useFonts,
} from "@expo-google-fonts/prompt";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import AlertHost from "./src/components/AlertHost";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { AppStackParamList, AuthStackParamList } from "./src/navigation/types";
import { isFirebaseConfigured } from "./src/services/firebase";
import { colors } from "./src/theme/colors";
import LoginScreen from "./src/screens/LoginScreen";
import CadastroScreen from "./src/screens/CadastroScreen";
import ClientesScreen from "./src/screens/ClientesScreen";
import NovoClienteScreen from "./src/screens/NovoClienteScreen";
import EstabelecimentosScreen from "./src/screens/EstabelecimentosScreen";
import ProdutosScreen from "./src/screens/ProdutosScreen";
import ClienteDetalheScreen from "./src/screens/ClienteDetalheScreen";
import RelatorioScreen from "./src/screens/RelatorioScreen";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function ConfiguracaoPendente() {
  return (
    <View style={styles.avisoContainer}>
      <Text style={styles.avisoTitulo}>Configure o Firebase</Text>
      <Text style={styles.avisoTexto}>
        Preencha as credenciais do seu projeto Firebase no arquivo{" "}
        <Text style={styles.avisoCodigo}>.env</Text> na raiz do projeto e reinicie o
        servidor (npx expo start) para o app funcionar.
      </Text>
    </View>
  );
}

function Root() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.avisoContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <AppStack.Navigator screenOptions={{ headerShown: false }}>
          <AppStack.Screen name="Clientes" component={ClientesScreen} />
          <AppStack.Screen
            name="NovoCliente"
            component={NovoClienteScreen}
            options={({ route }) => ({
              headerShown: true,
              title: route.params?.clienteId ? "Editar cliente" : "Novo cliente",
              headerStyle: { backgroundColor: colors.primary },
              headerTintColor: "#fff",
              headerTitleStyle: { fontFamily: "Prompt_600SemiBold" },
            })}
          />
          <AppStack.Screen
            name="ClienteDetalhe"
            component={ClienteDetalheScreen}
            options={{
              headerShown: true,
              title: "Ficha do cliente",
              headerStyle: { backgroundColor: colors.primary },
              headerTintColor: "#fff",
              headerTitleStyle: { fontFamily: "Prompt_600SemiBold" },
            }}
          />
          <AppStack.Screen
            name="Estabelecimentos"
            component={EstabelecimentosScreen}
            options={{
              headerShown: true,
              title: "Estabelecimentos",
              headerStyle: { backgroundColor: colors.primary },
              headerTintColor: "#fff",
              headerTitleStyle: { fontFamily: "Prompt_600SemiBold" },
            }}
          />
          <AppStack.Screen
            name="Produtos"
            component={ProdutosScreen}
            options={({ route }) => ({
              headerShown: true,
              title: route.params.estabelecimentoNome,
              headerStyle: { backgroundColor: colors.primary },
              headerTintColor: "#fff",
              headerTitleStyle: { fontFamily: "Prompt_600SemiBold" },
            })}
          />
          <AppStack.Screen
            name="Relatorio"
            component={RelatorioScreen}
            options={{
              headerShown: true,
              title: "Relatório",
              headerStyle: { backgroundColor: colors.primary },
              headerTintColor: "#fff",
              headerTitleStyle: { fontFamily: "Prompt_600SemiBold" },
            }}
          />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Cadastro" component={CadastroScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Prompt_400Regular,
    Prompt_500Medium,
    Prompt_600SemiBold,
    Prompt_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.avisoContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      {isFirebaseConfigured ? (
        <AuthProvider>
          <Root />
        </AuthProvider>
      ) : (
        <ConfiguracaoPendente />
      )}
      <AlertHost />
    </>
  );
}

const styles = StyleSheet.create({
  avisoContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.surface,
  },
  avisoTitulo: {
    fontSize: 20,
    fontFamily: "Prompt_600SemiBold",
    color: colors.text,
    marginBottom: 12,
  },
  avisoTexto: {
    fontSize: 15,
    fontFamily: "Prompt_400Regular",
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  avisoCodigo: { fontFamily: "monospace", fontWeight: "700" },
});
