import React from "react";
import {
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
  Icon,
  Box,
  Text,
  Flex
} from "@chakra-ui/react";
import { FaPalette, FaFont } from "react-icons/fa";
import { useThemeManager } from "../context/ThemeContext";
import { THEMES, FONTS } from "../theme";

const ThemeSwitcher = () => {
  const { 
    activeThemeKey, 
    activeFontKey,
    changeTheme, 
    changeFont,
    availableThemes,
    availableFonts 
  } = useThemeManager();

  return (
    <Flex position="fixed" top="20px" right="20px" zIndex={9999} gap={3}>
      
      {/* --- FONT SWITCHER --- */}
      <Menu placement="bottom-end">
        <MenuButton
          as={IconButton}
          icon={<Icon as={FaFont} />}
          aria-label="Font Switcher"
          variant="solid"
          colorScheme="gray"
          bg="var(--chakra-colors-surface)"
          color="var(--chakra-colors-textPrimary)"
          border="1px solid var(--chakra-colors-border)"
          borderRadius="full"
          size="lg"
          boxShadow="cardShadow"
          _hover={{ transform: "scale(1.1)", bg: "var(--chakra-colors-surfaceHover)" }}
          transition="all 0.2s"
        />
        <MenuList
          bg="cardBg"
          borderColor="border"
          backdropFilter="blur(24px)"
          boxShadow="cardShadowHover"
          borderRadius="xl"
          p={2}
          maxH="400px"
          overflowY="auto"
        >
          {availableFonts.map((key) => {
            const fontDef = FONTS[key];
            const isSelected = activeFontKey === key;
            return (
              <MenuItem
                key={key}
                onClick={() => changeFont(key)}
                bg={isSelected ? "surfaceHover" : "transparent"}
                _hover={{ bg: "surfaceHover", transform: "translateX(4px)" }}
                transition="all 0.2s"
                borderRadius="md"
                mb={1}
                fontFamily={fontDef.body}
              >
                <Text
                  fontWeight={isSelected ? "bold" : "medium"}
                  color={isSelected ? "brandPrimary" : "textPrimary"}
                  fontSize="sm"
                >
                  {fontDef.name}
                </Text>
              </MenuItem>
            );
          })}
        </MenuList>
      </Menu>

      {/* --- THEME SWITCHER --- */}
      <Menu placement="bottom-end">
        <MenuButton
          as={IconButton}
          icon={<Icon as={FaPalette} />}
          aria-label="Theme Switcher"
          variant="solid"
          colorScheme="gray"
          bg="brandPrimary"
          color="white"
          borderRadius="full"
          size="lg"
          boxShadow="glowShadow"
          _hover={{ transform: "scale(1.1)", bg: "brandHover" }}
          transition="all 0.2s"
        />
        <MenuList
          bg="cardBg"
          borderColor="border"
          backdropFilter="blur(24px)"
          boxShadow="cardShadowHover"
          borderRadius="xl"
          p={2}
          maxH="400px"
          overflowY="auto"
        >
          {availableThemes.map((key) => {
            const themeDef = THEMES[key];
            const isSelected = activeThemeKey === key;
            return (
              <MenuItem
                key={key}
                onClick={() => changeTheme(key)}
                bg={isSelected ? "surfaceHover" : "transparent"}
                _hover={{ bg: "surfaceHover", transform: "translateX(4px)" }}
                transition="all 0.2s"
                borderRadius="md"
                mb={1}
              >
                <Flex align="center" w="100%">
                  <Box
                    w={4}
                    h={4}
                    borderRadius="full"
                    bg={themeDef.colors.primary}
                    mr={3}
                    border="2px solid"
                    borderColor="borderSubtle"
                  />
                  <Text
                    fontWeight={isSelected ? "bold" : "medium"}
                    color={isSelected ? "brandPrimary" : "textPrimary"}
                    fontSize="sm"
                  >
                    {themeDef.name}
                  </Text>
                </Flex>
              </MenuItem>
            );
          })}
        </MenuList>
      </Menu>

    </Flex>
  );
};

export default ThemeSwitcher;
