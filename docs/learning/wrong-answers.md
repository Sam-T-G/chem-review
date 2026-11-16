# Wrong answers

What the app says when a student's answer is wrong. Sam asked for the app to explain the wrong assumption and guide the student to the right intuition (D-0012), and to say how a count is worked out before giving any number (D-0018). The card and the order below are the build session's design, and Sam has not confirmed them (D-0017).

Most wrong answers come from one specific mistake, like counting carbon's inner-shell electrons, so the card names that mistake.

## The card

Every wrong answer gets a card with three short parts (a `Coach` in `src/modules/lewis/guide.ts`, with the fields `lead`, `why` and `ask`):

1. **What the answer is** (`lead`). "6 is carbon's atomic number."
2. **Why that does not answer the question** (`why`). "The atomic number counts all 6 of carbon's electrons, and 2 of them are in the inner shell."
3. **What to do next** (`ask`). "Count only the electrons in carbon's outer shell."

## The mistakes each step recognizes

| Step | The wrong answer | What it is taken for |
|---|---|---|
| Count, one atom | the atomic number | every electron counted, inner shells too |
| | the number of that atom in the formula | the count for all of them instead of one |
| | 8 minus the right number | the electrons the atom is short of 8 |
| | 8 (2 for hydrogen) | a full shell |
| Count, the total | any total that fits none of the rows below | told what the total is made of: which atoms bring how many electrons, and what the charge does |
| | the neutral atoms' count | the charge left out |
| | the charge applied the wrong way | a negative charge read as fewer electrons |
| | each element counted once | the subscripts left out |
| | atomic numbers added up | every electron counted |
| Middle atom | hydrogen | hydrogen makes 1 bond (and a formula's first atom is not always the middle) |
| | an atom there are several of | only 1 atom is in the middle |
| Check | more electrons than the molecule has | electrons added by hand to fill a shell |
| | fewer electrons than the molecule has | electrons taken off |
| | full shells, formal charges that can be smaller | full shells taken for a finished drawing (more than one drawing fills every shell) |
| Shape, the groups | each shared pair counted | a double bond counted as 2 groups |
| | only the bonded atoms | lone pairs left out |
| | the lone pairs counted as 1 | each lone pair is its own group |
| | outer atoms' lone pairs counted | only the middle atom's groups set its shape |
| | 1 too many, no lone pairs | the middle atom counted as a group |
| Shape, the name | the arrangement of all the groups | lone pairs counted as corners of the shape |
| | the shape with no lone pairs | lone pairs left out |
| | square planar for 4 bonds | the flat drawing read as the shape |
| | any other shape | told what that shape needs, and what this molecule has |
| Polar, one bond | an arrow drawn toward the less electronegative atom | a dipole arrow points at the atom that pulls the shared electrons harder |
| | "Nonpolar, no arrow", for a polar bond | a bond is nonpolar only at a ΔEN of 0.4 or less |
| | an arrow drawn on a nonpolar bond (C–H) | only a polar bond has a dipole arrow, and a polar bond needs a ΔEN above 0.4 |
| Polar, the molecule | polar, when the dipoles cancel | polar bonds taken for a polar molecule |
| | polar, when no bond is polar | there are no bond dipoles to add up |
| | nonpolar, for a bent, pyramidal, seesaw, T-shaped or square pyramidal molecule | dipoles cancel only when the bonds are spread evenly |
| | nonpolar, when the outer atoms differ | dipoles cancel only when they are the same size |
| Polar, the net dipole drawn | within 35° of the opposite direction | the arrow points against the bond arrows, and the net dipole points toward δ− as they do |
| | along one bond, where several bond arrows add up | one bond's arrow taken for the sum of all of them |
| | any other direction | told how arrows are added: each starts where the one before ends |
| Orbitals, the counts | every line counted as a sigma bond | only the first bond between two atoms is a sigma bond |
| | no pi bonds, with a double or triple bond | a double or triple bond has pi bonds in it |
| | 1 pi bond for a triple bond | a triple bond has 2 pi bonds |
| | pi bonds, when every bond is single | a pi bond is a second or third bond |
| Orbitals, the hybridization | the one for the bonded atoms alone | a lone pair is a group too |
| | the one for every shared pair | a double or triple bond is 1 group |
| | any other | told how many groups that hybridization goes with |

An answer that matches none of these gets the plain version: it is wrong, and what to count.

## How a card behaves

- **How, before how many (D-0018).** A wrong total is never answered with the bare sum. The words say how the total is built ("the nitrogen atom brings 5 and each of the 3 hydrogen atoms brings 1"), then each kind of atom is added up, then the total is given in words ("5 from nitrogen and 3 from hydrogen make 8"). The Hint button says the same two things once every atom's count is right.
- **Pictures.** A wrong count for an atom can come with a picture of that atom's electron shells: gray rings and dots for the inner shells, a colored ring with the valence electrons on it. A wrong total comes with a picture of every atom in the molecule: a row for each kind of atom with one ball per atom and what that kind brings, a row for an ion's charge, and the total. The first miss shows the atoms alone, the second adds each row's sum, the third fills in the total. A wrong group count draws rings on the board around the groups the card is about (the double bonds, the lone pairs, or every group in turn).
- **The answer comes last.** On the first miss the card names the mistake, on the second it gives the rule or lists what is on the board, and on the third it gives the answer. The shape name is the exception: the student commits to one, the model lifts into 3D, and after a wrong pick the app gives the right shape at once. The whole-molecule question in step 6 has two answers, so its first pick is final too, and the card gives the right answer with the reason (D-0021).
- **The card stays up** while the student changes the number, so the picture can be counted from. The next check replaces it.
- **A wrong arrow stays on the board** (D-0023). A dipole arrow that was drawn wrong is redrawn in the color for mistakes, beside its bond or out of the middle atom, and the atoms it touches shake. It stays until the student starts the next arrow, so the card's first line ("That arrow points at carbon.") is about something the student can see. For the net dipole, the second miss names the line the net dipole runs along and leaves the way along it to the student. The third gives the direction in words: "from the middle of the 2 hydrogen atoms toward oxygen".
- **Every claim a card makes is tested against every problem it can appear in** (`tests/guide.test.ts`): if a card says "3 is the number of atoms bonded to nitrogen", a test checks that it is.

## Add a recognized mistake

Add a case to the step's `...Idea` function in `src/modules/lewis/guide.ts`, a test with the exact words, and a row to the table above. This is work inside D-0017 and does not need a new ask. Changing the card's three parts or the order of the reveal does.
