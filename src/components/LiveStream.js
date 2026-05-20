import React, { useState } from "react";
import { Box, Flex, Grid, Text, Button, IconButton, Image, Tooltip, VStack } from "@chakra-ui/react";
import { Radio, Mic, MicOff, Trash2, Plus, LogOut } from "lucide-react";
import { motion } from "framer-motion";

const MotionBox = motion(Box);

const LiveStream = () => {
  const [participants, setParticipants] = useState([]);

  const addParticipant = () => {
    const newParticipantId = participants.length + 1;
    const newParticipant = {
      id: newParticipantId,
      name: `Streamer ${newParticipantId}`,
      img: `https://i.pravatar.cc/150?img=${newParticipantId}`,
      isMuted: false,
    };
    setParticipants((prev) => [...prev, newParticipant]);
  };

  const removeParticipant = (id) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const toggleMute = (id) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isMuted: !p.isMuted } : p))
    );
  };

  return (
    <Flex h="100%" w="100%" direction="column" bg="var(--chakra-colors-bg)">
      {/* Header */}
      <Flex p={4} bg="var(--chakra-colors-surface)" borderBottom="1px solid var(--chakra-colors-border)" justify="space-between" align="center">
        <Flex align="center" gap={3}>
          <Box p={2} bg="red.500" borderRadius="full" animation="pulse 2s infinite">
            <Radio color="white" size={20} />
          </Box>
          <Text fontSize="xl" fontWeight="bold">Live Broadcast</Text>
        </Flex>
        <Flex gap={3}>
          <Button leftIcon={<Plus size={16} />} bg="var(--chakra-colors-brandPrimary)" color="white" _hover={{ bg: "var(--chakra-colors-brandHover)" }} onClick={addParticipant}>
            Add Streamer
          </Button>
          <Button leftIcon={<LogOut size={16} />} variant="outline" colorScheme="red">
            End Stream
          </Button>
        </Flex>
      </Flex>

      {/* Grid */}
      <Box p={6} flex={1} overflowY="auto">
        <Grid templateColumns="repeat(auto-fill, minmax(280px, 1fr))" gap={6}>
          {participants.map((participant) => (
            <MotionBox
              key={participant.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              position="relative"
              borderRadius="xl"
              overflow="hidden"
              bg="var(--chakra-colors-cardBg)"
              border="1px solid var(--chakra-colors-border)"
              boxShadow="lg"
              role="group"
            >
              <Image src={participant.img} alt={participant.name} w="100%" h="200px" objectFit="cover" />
              <Box p={4} bg="var(--chakra-colors-surface)">
                <Text fontWeight="bold" textAlign="center">{participant.name}</Text>
              </Box>

              {/* Hover Controls */}
              <Flex
                position="absolute"
                top={0} left={0} right={0} bottom={0}
                bg="rgba(0,0,0,0.6)"
                backdropFilter="blur(4px)"
                justify="center"
                align="center"
                gap={4}
                opacity={0}
                transition="opacity 0.3s"
                _groupHover={{ opacity: 1 }}
              >
                <Tooltip label={participant.isMuted ? "Unmute" : "Mute"}>
                  <IconButton
                    icon={participant.isMuted ? <MicOff /> : <Mic />}
                    isRound
                    size="lg"
                    bg={participant.isMuted ? "red.500" : "var(--chakra-colors-brandPrimary)"}
                    color="white"
                    _hover={{ bg: participant.isMuted ? "red.600" : "var(--chakra-colors-brandHover)" }}
                    onClick={() => toggleMute(participant.id)}
                  />
                </Tooltip>
                <Tooltip label="Remove from Stream">
                  <IconButton
                    icon={<Trash2 />}
                    isRound
                    size="lg"
                    bg="rgba(255,255,255,0.2)"
                    color="white"
                    _hover={{ bg: "red.500" }}
                    onClick={() => removeParticipant(participant.id)}
                  />
                </Tooltip>
              </Flex>
            </MotionBox>
          ))}
          {participants.length === 0 && (
            <Flex gridColumn="1 / -1" h="300px" justify="center" align="center" direction="column" color="var(--chakra-colors-textSecondary)">
              <Radio size={48} style={{ opacity: 0.5, marginBottom: "1rem" }} />
              <Text fontSize="lg">Stream is empty. Add a streamer to begin broadcasting.</Text>
            </Flex>
          )}
        </Grid>
      </Box>
    </Flex>
  );
};

export default LiveStream;
