import React, { useState } from "react";
import { Box, Flex, VStack, IconButton, Tooltip, Text, useBreakpointValue } from "@chakra-ui/react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { MessageSquare, Video, Radio, Menu, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import ThemeSwitcher from "./ThemeSwitcher";

const MotionBox = motion(Box);

const UnifiedWorkspace = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useBreakpointValue({ base: true, md: false });

  const NAV_ITEMS = [
    { path: "/", icon: <MessageSquare size={24} />, label: "Secure Chat" },
    { path: "/call", icon: <Video size={24} />, label: "E2EE Video Call" },
    { path: "/live-stream", icon: <Radio size={24} />, label: "Live Stream" },
  ];

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <Flex h="100vh" w="100vw" overflow="hidden" bg="var(--chakra-colors-bg)" color="var(--chakra-colors-textPrimary)">
      {/* Mobile Top Nav */}
      {isMobile && (
        <Flex
          position="absolute"
          top={0}
          left={0}
          w="100%"
          h="calc(60px + env(safe-area-inset-top, 0px))"
          pt="env(safe-area-inset-top, 0px)"
          bg="var(--chakra-colors-glassBg)"
          backdropFilter="blur(10px)"
          borderBottom="1px solid var(--chakra-colors-border)"
          alignItems="center"
          px={4}
          zIndex={20}
          justifyContent="space-between"
        >
          <Flex alignItems="center" gap={2}>
            <IconButton
              icon={<Menu />}
              variant="ghost"
              color="var(--chakra-colors-textPrimary)"
              onClick={toggleSidebar}
              aria-label="Open Menu"
            />
            <ShieldCheck color="var(--chakra-colors-brandPrimary)" />
            <Text fontWeight="bold">ChepraBai</Text>
          </Flex>
          <ThemeSwitcher />
        </Flex>
      )}

      {/* Sidebar Backdrop Overlay */}
      {isMobile && isSidebarOpen && (
        <Box
          position="fixed"
          inset={0}
          bg="rgba(0, 0, 0, 0.4)"
          backdropFilter="blur(2px)"
          zIndex={9}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <MotionBox
        w={{ base: isSidebarOpen ? "250px" : "0px", md: "80px" }}
        h="100%"
        bg="var(--chakra-colors-glassBg)"
        backdropFilter="blur(20px)"
        borderRight="1px solid var(--chakra-colors-border)"
        boxShadow="var(--chakra-colors-cardShadow)"
        display="flex"
        flexDirection="column"
        alignItems="center"
        py={isMobile ? "calc(80px + env(safe-area-inset-top, 0px))" : 6}
        position={{ base: "absolute", md: "relative" }}
        zIndex={10}
        overflow="hidden"
        initial={false}
        animate={{ width: isMobile ? (isSidebarOpen ? "250px" : "0px") : "80px" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {!isMobile && (
          <Box mb={8} color="var(--chakra-colors-brandPrimary)">
            <ShieldCheck size={32} />
          </Box>
        )}

        <VStack spacing={6} w="100%">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Tooltip key={item.path} label={isMobile ? "" : item.label} placement="right" hasArrow>
                <Flex
                  w={isMobile ? "90%" : "50px"}
                  h="50px"
                  bg={isActive ? "var(--chakra-colors-brandPrimary)" : "transparent"}
                  color={isActive ? "white" : "var(--chakra-colors-textSecondary)"}
                  borderRadius="14px"
                  alignItems="center"
                  justifyContent={isMobile ? "flex-start" : "center"}
                  px={isMobile ? 4 : 0}
                  cursor="pointer"
                  transition="all 0.2s"
                  _hover={{ bg: isActive ? "var(--chakra-colors-brandHover)" : "var(--chakra-colors-surfaceHover)" }}
                  onClick={() => {
                    navigate(item.path);
                    if (isMobile) setIsSidebarOpen(false);
                  }}
                >
                  {item.icon}
                  {isMobile && (
                    <Text ml={4} fontWeight={isActive ? "bold" : "normal"}>
                      {item.label}
                    </Text>
                  )}
                </Flex>
              </Tooltip>
            );
          })}
        </VStack>
        
        {/* Theme Switcher at bottom for Desktop */}
        {!isMobile && (
          <Box mt="auto" mb={4}>
            <ThemeSwitcher />
          </Box>
        )}
      </MotionBox>

      {/* Main Content Area */}
      <Box flex={1} position="relative" pt={isMobile ? "calc(60px + env(safe-area-inset-top, 0px))" : 0} overflow="hidden">
        <Outlet />
      </Box>
    </Flex>
  );
};

export default UnifiedWorkspace;
